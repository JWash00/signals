-- ============================================================
-- SIGNALFORGE — SUPABASE SCHEMA
-- Migration: 001_initial_schema.sql
-- 
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- Or via CLI: supabase db push
--
-- This creates everything: tables, indexes, functions, triggers,
-- RLS policies, and the cron scheduling infrastructure.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 0. EXTENSIONS
-- ────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
-- CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- trigram index for text search

-- ────────────────────────────────────────────────────────────
-- 1. ENUMS (enforced vocabulary — no garbage data)
-- ────────────────────────────────────────────────────────────

CREATE TYPE signal_source AS ENUM (
    'reddit',
    'youtube',
    'linkedin',
    'twitter_x',
    'g2',
    'capterra',
    'app_store_ios',
    'app_store_android',
    'hacker_news',
    'indie_hackers',
    'product_hunt',
    'upwork',
    'facebook',
    'quora',
    'stack_overflow',
    'other'
);

CREATE TYPE pain_category AS ENUM (
    'workflow_friction',
    'missing_feature',
    'cost_complaint',
    'integration_gap',
    'reliability_issue',
    'complexity_complaint',
    'support_failure',
    'scaling_limitation',
    'security_concern',
    'onboarding_friction',
    'performance_issue',
    'data_portability',
    'uncategorized'
);

CREATE TYPE wtp_signal AS ENUM (
    'none',
    'implicit',      -- "I'd switch to something better"
    'explicit',      -- "I'd pay $50/mo for this"
    'proven'         -- actual Upwork spend / competitor pricing
);

CREATE TYPE opportunity_tier AS ENUM ('A', 'B', 'C', 'D');

CREATE TYPE opportunity_status AS ENUM (
    'scored',
    'investigating',
    'validating',
    'confirmed',
    'killed',
    'building',
    'launched'
);

CREATE TYPE alert_severity AS ENUM ('info', 'warning', 'critical');

CREATE TYPE alert_type AS ENUM (
    'new_opportunity',
    'score_change',
    'tier_upgrade',
    'competitor_move',
    'viral_thread',
    'competitor_shutdown',
    'trend_spike',
    'validation_result'
);

-- ────────────────────────────────────────────────────────────
-- 2. CORE TABLES
-- ────────────────────────────────────────────────────────────

-- ─── RAW SIGNALS ─────────────────────────────────────────────
-- Every pain signal from every platform lands here first.
-- This is the firehose. Expect 500-5,000 rows/day at scale.

CREATE TABLE raw_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Source identification
    source signal_source NOT NULL,
    source_url TEXT,
    source_id TEXT,                          -- platform-native ID (reddit post ID, YT comment ID, etc.)

    -- Content
    raw_text TEXT NOT NULL,
    author TEXT,
    thread_title TEXT,                       -- parent post/video title for context
    parent_context TEXT,                     -- subreddit, channel name, G2 product, etc.

    -- Engagement metrics (normalized across platforms)
    upvotes INT DEFAULT 0,
    comments INT DEFAULT 0,
    shares INT DEFAULT 0,
    engagement_score INT GENERATED ALWAYS AS (
        upvotes + (comments * 3) + (shares * 5)
    ) STORED,                               -- weighted composite — comments worth 3x upvotes

    -- Timestamps
    published_at TIMESTAMPTZ,               -- when the original was posted
    ingested_at TIMESTAMPTZ DEFAULT NOW(),

    -- Classification (populated by Classifier agent)
    classification JSONB DEFAULT NULL,       -- full LLM output
    pain_category pain_category DEFAULT 'uncategorized',
    intensity SMALLINT CHECK (intensity BETWEEN 1 AND 10),
    specificity SMALLINT CHECK (specificity BETWEEN 1 AND 10),
    wtp wtp_signal DEFAULT 'none',
    budget_mentioned NUMERIC(10,2),          -- dollar amount if stated
    tools_mentioned TEXT[] DEFAULT '{}',
    existing_workarounds TEXT,
    target_persona TEXT,
    suggested_niche TEXT,

    -- Processing state
    is_noise BOOLEAN DEFAULT FALSE,
    is_processed BOOLEAN DEFAULT FALSE,
    cluster_id UUID,                         -- set after clustering

    -- Embeddings for semantic dedup + clustering
    embedding extensions.vector(1536),

    -- Dedup
    content_hash TEXT GENERATED ALWAYS AS (
        md5(lower(trim(raw_text)))
    ) STORED,

    CONSTRAINT unique_content_hash UNIQUE (content_hash)
);

-- ─── PAIN CLUSTERS ───────────────────────────────────────────
-- Deduplicated, aggregated pain patterns.
-- This is where raw noise becomes actionable signal.
-- Expect 50-500 active clusters.

CREATE TABLE pain_clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity
    title TEXT NOT NULL,                     -- e.g., "Invoice reconciliation for agencies"
    description TEXT,                        -- 2-3 sentence summary
    slug TEXT UNIQUE,                        -- URL-safe identifier

    -- Classification
    pain_category pain_category NOT NULL,
    subcategory TEXT,                         -- more specific than the enum

    -- Signal aggregates (updated by trigger)
    signal_count INT DEFAULT 0,
    avg_intensity FLOAT DEFAULT 0,
    max_intensity SMALLINT DEFAULT 0,
    avg_specificity FLOAT DEFAULT 0,
    avg_engagement FLOAT DEFAULT 0,
    total_engagement INT DEFAULT 0,
    platform_count INT DEFAULT 0,
    platforms signal_source[] DEFAULT '{}',

    -- Temporal
    first_seen TIMESTAMPTZ,
    last_seen TIMESTAMPTZ,
    velocity_7d FLOAT DEFAULT 0,             -- signals per week (last 7 days)
    velocity_30d FLOAT DEFAULT 0,            -- signals per week (last 30 days)
    velocity_trend TEXT DEFAULT 'stable',     -- accelerating, stable, decelerating

    -- Evidence (the quotes that prove this is real)
    top_quotes JSONB DEFAULT '[]',
    -- Format: [{text, source, url, upvotes, date}]
    -- Keep top 10, sorted by engagement

    -- Solution landscape
    tools_mentioned TEXT[] DEFAULT '{}',      -- all tools users reference
    wtp_ratio FLOAT DEFAULT 0,               -- % of signals with WTP language
    avg_budget_mentioned NUMERIC(10,2),       -- average $ amount when stated
    max_budget_mentioned NUMERIC(10,2),

    -- Semantic center
    centroid extensions.vector(1536),

    -- Metadata
    last_clustered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── COMPETITORS ─────────────────────────────────────────────
-- Lean competitor profiles. One row per competitor per cluster.
-- A competitor can appear in multiple clusters.

CREATE TABLE competitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id UUID NOT NULL REFERENCES pain_clusters(id) ON DELETE CASCADE,

    -- Identity
    name TEXT NOT NULL,
    url TEXT,
    logo_url TEXT,

    -- Company basics
    founded_year SMALLINT,
    team_size_estimate INT,
    funding_total TEXT,                       -- "$2.5M Seed", "$14M Series A"
    funding_stage TEXT,                       -- pre-seed, seed, A, B, C, growth, public
    headquarters TEXT,

    -- Product
    pricing JSONB DEFAULT '{}',
    -- Format: {free_tier: bool, entry: "$29/mo", mid: "$79/mo", enterprise: "custom"}
    features TEXT[] DEFAULT '{}',
    missing_features TEXT[] DEFAULT '{}',     -- from user complaints
    tech_stack TEXT[] DEFAULT '{}',

    -- Market position
    monthly_traffic INT,
    traffic_trend TEXT,                       -- "+12% MoM", "-5% MoM", "stable"
    g2_rating FLOAT,
    g2_review_count INT,
    capterra_rating FLOAT,
    app_store_rating FLOAT,

    -- Intelligence
    top_complaints TEXT[] DEFAULT '{}',       -- top 5 from reviews
    moat_assessment TEXT,                     -- "weak", "moderate", "strong" + explanation
    vulnerability_assessment TEXT,            -- why/how they can be beaten
    estimated_mrr TEXT,                       -- "$50K-$150K"
    estimated_customers INT,

    -- Metadata
    data_sources TEXT[] DEFAULT '{}',        -- where this intel came from
    confidence TEXT DEFAULT 'low',           -- low, medium, high
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_competitor_per_cluster UNIQUE (cluster_id, url)
);

-- ─── OPPORTUNITIES ───────────────────────────────────────────
-- Scored, ranked, actionable business opportunities.
-- This is what the daily briefing reads from.

CREATE TABLE opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id UUID NOT NULL REFERENCES pain_clusters(id) ON DELETE CASCADE,

    -- Identity
    title TEXT NOT NULL,
    description TEXT,                        -- 2-3 sentences: what to build

    -- Scores (0-25 per dimension, total 0-100)
    score_total FLOAT DEFAULT 0,
    score_pain FLOAT DEFAULT 0,              -- max 25
    score_velocity FLOAT DEFAULT 0,          -- max 20
    score_wtp FLOAT DEFAULT 0,               -- max 25
    score_competition FLOAT DEFAULT 0,       -- max 15
    score_feasibility FLOAT DEFAULT 0,       -- max 15
    tier opportunity_tier DEFAULT 'D',
    score_history JSONB DEFAULT '[]',
    -- Format: [{date, total, pain, velocity, wtp, competition, feasibility, reason}]

    -- Status
    status opportunity_status DEFAULT 'scored',
    kill_reason TEXT,
    killed_at TIMESTAMPTZ,

    -- Market sizing
    tam_estimate TEXT,                       -- "$2.4B" with methodology note
    tam_methodology TEXT,
    beachhead_market TEXT,                   -- specific first segment to target

    -- Go-to-market
    positioning TEXT,                        -- one-sentence positioning statement
    differentiator TEXT,                     -- what makes this different from competitors
    pricing_recommendation JSONB,
    -- Format: {entry: "$29/mo", mid: "$79/mo", pro: "$149/mo"}
    distribution_channels TEXT[] DEFAULT '{}',
    mvp_description TEXT,
    mvp_build_days INT,                      -- estimated days to MVP

    -- Competitor summary
    competitor_count INT DEFAULT 0,
    strongest_competitor TEXT,
    weakest_competitor TEXT,
    primary_gap TEXT,                         -- the #1 unmet need

    -- Validation
    validation_stage TEXT DEFAULT 'unvalidated',
    -- unvalidated, signal_check, demand_check, econ_check, landing_page, survey, confirmed
    landing_page_url TEXT,
    landing_page_signup_rate FLOAT,
    survey_yes_rate FLOAT,

    -- Dossier
    dossier_markdown TEXT,
    dossier_generated_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ALERTS ──────────────────────────────────────────────────
-- Every notable event. Read by the daily briefing and Slack bot.

CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
    cluster_id UUID REFERENCES pain_clusters(id) ON DELETE SET NULL,

    alert_type alert_type NOT NULL,
    severity alert_severity NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',             -- flexible payload per alert type

    delivered_slack BOOLEAN DEFAULT FALSE,
    delivered_email BOOLEAN DEFAULT FALSE,
    read BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INGESTION RUNS ──────────────────────────────────────────
-- Track every agent run for debugging and monitoring.

CREATE TABLE ingestion_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name TEXT NOT NULL,                -- 'scout_reddit', 'scout_youtube', etc.
    source signal_source,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    signals_found INT DEFAULT 0,
    signals_new INT DEFAULT 0,               -- after dedup
    signals_noise INT DEFAULT 0,
    errors JSONB DEFAULT '[]',
    status TEXT DEFAULT 'running',           -- running, completed, failed
    duration_seconds FLOAT
);

-- ─── SCORING SNAPSHOTS ───────────────────────────────────────
-- Daily snapshot of all opportunity scores for trend analysis.

CREATE TABLE scoring_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    score_total FLOAT,
    score_pain FLOAT,
    score_velocity FLOAT,
    score_wtp FLOAT,
    score_competition FLOAT,
    score_feasibility FLOAT,
    tier opportunity_tier,
    signal_count INT,
    competitor_count INT,

    CONSTRAINT unique_snapshot UNIQUE (opportunity_id, snapshot_date)
);


-- ────────────────────────────────────────────────────────────
-- 3. INDEXES (only the ones that earn their keep)
-- ────────────────────────────────────────────────────────────

-- Raw signals
CREATE INDEX idx_signals_unprocessed ON raw_signals (is_processed) WHERE is_processed = FALSE;
CREATE INDEX idx_signals_not_noise ON raw_signals (ingested_at DESC) WHERE is_noise = FALSE;
CREATE INDEX idx_signals_source ON raw_signals (source, ingested_at DESC);
CREATE INDEX idx_signals_cluster ON raw_signals (cluster_id) WHERE cluster_id IS NOT NULL;
CREATE INDEX idx_signals_category ON raw_signals (pain_category) WHERE pain_category != 'uncategorized';
CREATE INDEX idx_signals_wtp ON raw_signals (wtp) WHERE wtp IN ('explicit', 'proven');
CREATE INDEX idx_signals_tools ON raw_signals USING GIN (tools_mentioned);
CREATE INDEX idx_signals_text_search ON raw_signals USING GIN (raw_text gin_trgm_ops);

-- Vector indexes (HNSW for fast approximate nearest neighbor)
CREATE INDEX idx_signals_embedding ON raw_signals
    USING hnsw (embedding extensions.vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_clusters_centroid ON pain_clusters
    USING hnsw (centroid extensions.vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Pain clusters
CREATE INDEX idx_clusters_velocity ON pain_clusters (velocity_7d DESC);
CREATE INDEX idx_clusters_category ON pain_clusters (pain_category);
CREATE INDEX idx_clusters_signal_count ON pain_clusters (signal_count DESC);
CREATE INDEX idx_clusters_last_seen ON pain_clusters (last_seen DESC);

-- Opportunities
CREATE INDEX idx_opps_score ON opportunities (score_total DESC);
CREATE INDEX idx_opps_tier ON opportunities (tier);
CREATE INDEX idx_opps_status ON opportunities (status);
CREATE INDEX idx_opps_tier_status ON opportunities (tier, status);

-- Competitors
CREATE INDEX idx_competitors_cluster ON competitors (cluster_id);
CREATE INDEX idx_competitors_rating ON competitors (g2_rating DESC NULLS LAST);

-- Alerts
CREATE INDEX idx_alerts_undelivered ON alerts (created_at DESC) WHERE delivered_slack = FALSE;
CREATE INDEX idx_alerts_severity ON alerts (severity, created_at DESC);
CREATE INDEX idx_alerts_type ON alerts (alert_type, created_at DESC);

-- Scoring snapshots
CREATE INDEX idx_snapshots_opp_date ON scoring_snapshots (opportunity_id, snapshot_date DESC);


-- ────────────────────────────────────────────────────────────
-- 4. FUNCTIONS
-- ────────────────────────────────────────────────────────────

-- ─── Find semantically similar signals (dedup check) ─────────
CREATE OR REPLACE FUNCTION find_similar_signals(
    query_embedding extensions.vector(1536),
    similarity_threshold FLOAT DEFAULT 0.87,
    max_results INT DEFAULT 5
)
RETURNS TABLE (
    signal_id UUID,
    similarity FLOAT,
    raw_text TEXT,
    cluster_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        rs.id,
        (1 - (rs.embedding <=> query_embedding))::FLOAT,
        rs.raw_text,
        rs.cluster_id
    FROM raw_signals rs
    WHERE rs.is_noise = FALSE
      AND rs.embedding IS NOT NULL
      AND (1 - (rs.embedding <=> query_embedding)) > similarity_threshold
    ORDER BY rs.embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;


-- ─── Find similar pain clusters (for new signal assignment) ──
CREATE OR REPLACE FUNCTION find_similar_clusters(
    query_embedding extensions.vector(1536),
    similarity_threshold FLOAT DEFAULT 0.82,
    max_results INT DEFAULT 3
)
RETURNS TABLE (
    cluster_id UUID,
    title TEXT,
    similarity FLOAT,
    signal_count INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pc.id,
        pc.title,
        (1 - (pc.centroid <=> query_embedding))::FLOAT,
        pc.signal_count
    FROM pain_clusters pc
    WHERE pc.centroid IS NOT NULL
      AND (1 - (pc.centroid <=> query_embedding)) > similarity_threshold
    ORDER BY pc.centroid <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;


-- ─── Update cluster aggregates after signal assignment ────────
CREATE OR REPLACE FUNCTION update_cluster_aggregates(target_cluster_id UUID)
RETURNS void AS $$
DECLARE
    v_signal_count INT;
    v_avg_intensity FLOAT;
    v_max_intensity SMALLINT;
    v_avg_specificity FLOAT;
    v_avg_engagement FLOAT;
    v_total_engagement INT;
    v_platforms signal_source[];
    v_first_seen TIMESTAMPTZ;
    v_last_seen TIMESTAMPTZ;
    v_velocity_7d FLOAT;
    v_velocity_30d FLOAT;
    v_wtp_ratio FLOAT;
    v_avg_budget NUMERIC;
    v_max_budget NUMERIC;
    v_tools TEXT[];
    v_top_quotes JSONB;
BEGIN
    -- Core aggregates
    SELECT
        COUNT(*),
        AVG(intensity)::FLOAT,
        MAX(intensity),
        AVG(specificity)::FLOAT,
        AVG(engagement_score)::FLOAT,
        SUM(engagement_score),
        ARRAY_AGG(DISTINCT source),
        MIN(published_at),
        MAX(published_at),
        AVG(CASE WHEN wtp IN ('explicit', 'proven') THEN 1.0 ELSE 0.0 END)::FLOAT,
        AVG(budget_mentioned),
        MAX(budget_mentioned)
    INTO
        v_signal_count, v_avg_intensity, v_max_intensity, v_avg_specificity,
        v_avg_engagement, v_total_engagement, v_platforms,
        v_first_seen, v_last_seen, v_wtp_ratio, v_avg_budget, v_max_budget
    FROM raw_signals
    WHERE cluster_id = target_cluster_id
      AND is_noise = FALSE;

    -- Velocity: signals in last 7 days / 1 week
    SELECT COUNT(*)::FLOAT
    INTO v_velocity_7d
    FROM raw_signals
    WHERE cluster_id = target_cluster_id
      AND is_noise = FALSE
      AND ingested_at > NOW() - INTERVAL '7 days';

    -- Velocity: signals in last 30 days / ~4.3 weeks
    SELECT (COUNT(*)::FLOAT / 4.3)
    INTO v_velocity_30d
    FROM raw_signals
    WHERE cluster_id = target_cluster_id
      AND is_noise = FALSE
      AND ingested_at > NOW() - INTERVAL '30 days';

    -- Unique tools mentioned
    SELECT ARRAY_AGG(DISTINCT tool)
    INTO v_tools
    FROM raw_signals, UNNEST(tools_mentioned) AS tool
    WHERE cluster_id = target_cluster_id
      AND is_noise = FALSE;

    -- Top quotes (top 10 by engagement)
    SELECT COALESCE(jsonb_agg(q ORDER BY (q->>'engagement')::INT DESC), '[]'::JSONB)
    INTO v_top_quotes
    FROM (
        SELECT jsonb_build_object(
            'text', LEFT(raw_text, 300),
            'source', source::TEXT,
            'url', source_url,
            'engagement', engagement_score,
            'date', published_at::TEXT
        ) AS q
        FROM raw_signals
        WHERE cluster_id = target_cluster_id
          AND is_noise = FALSE
          AND engagement_score > 0
        ORDER BY engagement_score DESC
        LIMIT 10
    ) sub;

    -- Write it all back
    UPDATE pain_clusters SET
        signal_count = COALESCE(v_signal_count, 0),
        avg_intensity = COALESCE(v_avg_intensity, 0),
        max_intensity = COALESCE(v_max_intensity, 0),
        avg_specificity = COALESCE(v_avg_specificity, 0),
        avg_engagement = COALESCE(v_avg_engagement, 0),
        total_engagement = COALESCE(v_total_engagement, 0),
        platform_count = COALESCE(array_length(v_platforms, 1), 0),
        platforms = COALESCE(v_platforms, '{}'),
        first_seen = v_first_seen,
        last_seen = v_last_seen,
        velocity_7d = COALESCE(v_velocity_7d, 0),
        velocity_30d = COALESCE(v_velocity_30d, 0),
        velocity_trend = CASE
            WHEN v_velocity_7d > v_velocity_30d * 1.5 THEN 'accelerating'
            WHEN v_velocity_7d < v_velocity_30d * 0.5 THEN 'decelerating'
            ELSE 'stable'
        END,
        wtp_ratio = COALESCE(v_wtp_ratio, 0),
        avg_budget_mentioned = v_avg_budget,
        max_budget_mentioned = v_max_budget,
        tools_mentioned = COALESCE(v_tools, '{}'),
        top_quotes = COALESCE(v_top_quotes, '[]'::JSONB),
        updated_at = NOW()
    WHERE id = target_cluster_id;
END;
$$ LANGUAGE plpgsql;


-- ─── Calculate opportunity tier from score ────────────────────
CREATE OR REPLACE FUNCTION calculate_tier(score FLOAT)
RETURNS opportunity_tier AS $$
BEGIN
    RETURN CASE
        WHEN score >= 75 THEN 'A'::opportunity_tier
        WHEN score >= 55 THEN 'B'::opportunity_tier
        WHEN score >= 35 THEN 'C'::opportunity_tier
        ELSE 'D'::opportunity_tier
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ─── Daily briefing query ─────────────────────────────────────
CREATE OR REPLACE FUNCTION get_daily_briefing()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'generated_at', NOW(),
        'top_new_opportunities', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', o.id,
                'title', o.title,
                'score', o.score_total,
                'tier', o.tier,
                'description', o.description,
                'signal_count', pc.signal_count,
                'platforms', pc.platforms,
                'velocity_7d', pc.velocity_7d,
                'top_quote', pc.top_quotes->0->>'text'
            ) ORDER BY o.score_total DESC), '[]'::JSONB)
            FROM opportunities o
            JOIN pain_clusters pc ON o.cluster_id = pc.id
            WHERE o.created_at > NOW() - INTERVAL '24 hours'
              AND o.tier IN ('A', 'B')
        ),
        'score_changes', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', o.id,
                'title', o.title,
                'current_score', o.score_total,
                'previous_score', (
                    SELECT ss.score_total
                    FROM scoring_snapshots ss
                    WHERE ss.opportunity_id = o.id
                      AND ss.snapshot_date = CURRENT_DATE - 1
                    LIMIT 1
                ),
                'change', o.score_total - COALESCE((
                    SELECT ss.score_total
                    FROM scoring_snapshots ss
                    WHERE ss.opportunity_id = o.id
                      AND ss.snapshot_date = CURRENT_DATE - 1
                    LIMIT 1
                ), o.score_total)
            ) ORDER BY ABS(o.score_total - COALESCE((
                SELECT ss.score_total
                FROM scoring_snapshots ss
                WHERE ss.opportunity_id = o.id
                  AND ss.snapshot_date = CURRENT_DATE - 1
                LIMIT 1
            ), o.score_total)) DESC), '[]'::JSONB)
            FROM opportunities o
            WHERE o.status NOT IN ('killed', 'launched')
              AND o.tier IN ('A', 'B')
        ),
        'undelivered_alerts', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', a.id,
                'type', a.alert_type,
                'severity', a.severity,
                'title', a.title,
                'message', a.message,
                'created_at', a.created_at
            ) ORDER BY
                CASE a.severity
                    WHEN 'critical' THEN 1
                    WHEN 'warning' THEN 2
                    ELSE 3
                END,
                a.created_at DESC
            ), '[]'::JSONB)
            FROM alerts a
            WHERE a.delivered_email = FALSE
        ),
        'stats_7d', (
            SELECT jsonb_build_object(
                'signals_ingested', (
                    SELECT COUNT(*) FROM raw_signals
                    WHERE ingested_at > NOW() - INTERVAL '7 days'
                ),
                'signals_classified', (
                    SELECT COUNT(*) FROM raw_signals
                    WHERE ingested_at > NOW() - INTERVAL '7 days'
                      AND is_processed = TRUE AND is_noise = FALSE
                ),
                'clusters_updated', (
                    SELECT COUNT(*) FROM pain_clusters
                    WHERE updated_at > NOW() - INTERVAL '7 days'
                ),
                'tier_a_count', (
                    SELECT COUNT(*) FROM opportunities WHERE tier = 'A' AND status != 'killed'
                ),
                'tier_b_count', (
                    SELECT COUNT(*) FROM opportunities WHERE tier = 'B' AND status != 'killed'
                )
            )
        )
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql;


-- ────────────────────────────────────────────────────────────
-- 5. TRIGGERS
-- ────────────────────────────────────────────────────────────

-- ─── Auto-update cluster aggregates when signal is assigned ──
CREATE OR REPLACE FUNCTION trigger_update_cluster_on_signal()
RETURNS TRIGGER AS $$
BEGIN
    -- When a signal gets assigned to a cluster
    IF NEW.cluster_id IS NOT NULL AND (OLD.cluster_id IS NULL OR OLD.cluster_id != NEW.cluster_id) THEN
        PERFORM update_cluster_aggregates(NEW.cluster_id);
    END IF;
    -- If moved from one cluster to another, update the old one too
    IF OLD.cluster_id IS NOT NULL AND OLD.cluster_id != COALESCE(NEW.cluster_id, gen_random_uuid()) THEN
        PERFORM update_cluster_aggregates(OLD.cluster_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_signal_cluster_update
    AFTER UPDATE OF cluster_id ON raw_signals
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_cluster_on_signal();


-- ─── Auto-calculate tier when score changes ──────────────────
CREATE OR REPLACE FUNCTION trigger_update_opportunity_tier()
RETURNS TRIGGER AS $$
BEGIN
    NEW.tier = calculate_tier(NEW.score_total);
    NEW.updated_at = NOW();

    -- Auto-generate alert on tier upgrade
    IF OLD.tier IS NOT NULL AND NEW.tier < OLD.tier THEN  -- A < B < C < D in enum order
        INSERT INTO alerts (opportunity_id, alert_type, severity, title, message, metadata)
        VALUES (
            NEW.id,
            'tier_upgrade',
            CASE NEW.tier WHEN 'A' THEN 'critical' ELSE 'warning' END,
            'Tier upgrade: ' || NEW.title,
            format('Score changed from %s to %s (Tier %s → %s)',
                   round(OLD.score_total::NUMERIC, 1),
                   round(NEW.score_total::NUMERIC, 1),
                   OLD.tier, NEW.tier),
            jsonb_build_object('old_score', OLD.score_total, 'new_score', NEW.score_total)
        );
    END IF;

    -- Auto-generate alert on significant score change (±5 points)
    IF ABS(NEW.score_total - COALESCE(OLD.score_total, 0)) >= 5 THEN
        INSERT INTO alerts (opportunity_id, alert_type, severity, title, message, metadata)
        VALUES (
            NEW.id,
            'score_change',
            'info',
            'Score shift: ' || NEW.title,
            format('%s → %s (%s%s)',
                   round(OLD.score_total::NUMERIC, 1),
                   round(NEW.score_total::NUMERIC, 1),
                   CASE WHEN NEW.score_total > OLD.score_total THEN '+' ELSE '' END,
                   round((NEW.score_total - OLD.score_total)::NUMERIC, 1)),
            jsonb_build_object('old_score', OLD.score_total, 'new_score', NEW.score_total)
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_opportunity_tier
    BEFORE UPDATE OF score_total ON opportunities
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_opportunity_tier();


-- ─── Auto-set tier on insert ─────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_set_initial_tier()
RETURNS TRIGGER AS $$
BEGIN
    NEW.tier = calculate_tier(NEW.score_total);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_opportunity_initial_tier
    BEFORE INSERT ON opportunities
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_initial_tier();


-- ─── Auto-update updated_at timestamps ───────────────────────
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clusters_updated_at
    BEFORE UPDATE ON pain_clusters
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ────────────────────────────────────────────────────────────
-- 6. ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────
-- For now, use service_role key from n8n (bypasses RLS).
-- Enable RLS and add policies when you build the dashboard.

ALTER TABLE raw_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE pain_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_snapshots ENABLE ROW LEVEL SECURITY;

-- Service role bypass (n8n agents use service_role key)
CREATE POLICY "service_role_all" ON raw_signals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON pain_clusters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON competitors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON opportunities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON alerts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON ingestion_runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON scoring_snapshots FOR ALL USING (true) WITH CHECK (true);


-- ────────────────────────────────────────────────────────────
-- 7. VIEWS (pre-built queries for common operations)
-- ────────────────────────────────────────────────────────────

-- ─── Active opportunities ranked by score ─────────────────────
CREATE VIEW v_active_opportunities AS
SELECT
    o.id,
    o.title,
    o.description,
    o.score_total,
    o.score_pain,
    o.score_velocity,
    o.score_wtp,
    o.score_competition,
    o.score_feasibility,
    o.tier,
    o.status,
    o.positioning,
    o.tam_estimate,
    o.competitor_count,
    o.primary_gap,
    o.mvp_build_days,
    o.validation_stage,
    pc.signal_count,
    pc.velocity_7d,
    pc.velocity_trend,
    pc.wtp_ratio,
    pc.platforms,
    pc.top_quotes->0->>'text' AS top_quote,
    o.created_at,
    o.updated_at
FROM opportunities o
JOIN pain_clusters pc ON o.cluster_id = pc.id
WHERE o.status NOT IN ('killed', 'launched')
ORDER BY o.score_total DESC;


-- ─── Accelerating pain clusters (emerging trends) ─────────────
CREATE VIEW v_trending_clusters AS
SELECT
    pc.id,
    pc.title,
    pc.pain_category,
    pc.signal_count,
    pc.velocity_7d,
    pc.velocity_30d,
    pc.velocity_trend,
    pc.avg_intensity,
    pc.wtp_ratio,
    pc.platform_count,
    pc.platforms,
    pc.top_quotes->0->>'text' AS top_quote,
    pc.last_seen
FROM pain_clusters pc
WHERE pc.velocity_trend = 'accelerating'
  AND pc.signal_count >= 5
ORDER BY pc.velocity_7d DESC;


-- ─── Unprocessed signal queue ─────────────────────────────────
CREATE VIEW v_signal_queue AS
SELECT
    id,
    source,
    raw_text,
    engagement_score,
    published_at,
    ingested_at
FROM raw_signals
WHERE is_processed = FALSE
ORDER BY engagement_score DESC, ingested_at ASC;


-- ─── Competitor weakness map ──────────────────────────────────
CREATE VIEW v_competitor_weaknesses AS
SELECT
    c.name,
    c.url,
    c.g2_rating,
    c.monthly_traffic,
    c.estimated_mrr,
    c.top_complaints,
    c.missing_features,
    c.vulnerability_assessment,
    pc.title AS pain_cluster,
    o.score_total AS opportunity_score,
    o.tier AS opportunity_tier
FROM competitors c
JOIN pain_clusters pc ON c.cluster_id = pc.id
LEFT JOIN opportunities o ON o.cluster_id = pc.id
WHERE c.g2_rating < 4.0 OR c.vulnerability_assessment IS NOT NULL
ORDER BY o.score_total DESC NULLS LAST;


-- ────────────────────────────────────────────────────────────
-- 8. DAILY MAINTENANCE (pg_cron)
-- ────────────────────────────────────────────────────────────

-- Take daily scoring snapshots at midnight UTC
-- SELECT cron.schedule(
--     'daily-scoring-snapshot',
--     '0 0 * * *',
--     $$
--     INSERT INTO scoring_snapshots (opportunity_id, snapshot_date, score_total, score_pain,
--         score_velocity, score_wtp, score_competition, score_feasibility, tier,
--         signal_count, competitor_count)
--     SELECT
--         o.id, CURRENT_DATE, o.score_total, o.score_pain,
--         o.score_velocity, o.score_wtp, o.score_competition, o.score_feasibility, o.tier,
--         pc.signal_count, o.competitor_count
--     FROM opportunities o
--     JOIN pain_clusters pc ON o.cluster_id = pc.id
--     WHERE o.status NOT IN ('killed', 'launched')
--     ON CONFLICT (opportunity_id, snapshot_date) DO UPDATE
--     SET score_total = EXCLUDED.score_total,
--         tier = EXCLUDED.tier,
--         signal_count = EXCLUDED.signal_count;
--     $$
-- );

-- Clean up old noise signals (>90 days, marked as noise)
-- SELECT cron.schedule(
--     'cleanup-noise-signals',
--     '0 2 * * 0',  -- Weekly on Sunday at 2 AM UTC
--     $$
--     DELETE FROM raw_signals
--     WHERE is_noise = TRUE
--       AND ingested_at < NOW() - INTERVAL '90 days';
--     $$
-- );

-- Refresh cluster velocities every 6 hours
-- SELECT cron.schedule(
--     'refresh-cluster-velocities',
--     '0 */6 * * *',
--     $$
--     UPDATE pain_clusters SET
--         velocity_7d = (
--             SELECT COUNT(*)::FLOAT
--             FROM raw_signals rs
--             WHERE rs.cluster_id = pain_clusters.id
--               AND rs.is_noise = FALSE
--               AND rs.ingested_at > NOW() - INTERVAL '7 days'
--         ),
--         velocity_30d = (
--             SELECT (COUNT(*)::FLOAT / 4.3)
--             FROM raw_signals rs
--             WHERE rs.cluster_id = pain_clusters.id
--               AND rs.is_noise = FALSE
--               AND rs.ingested_at > NOW() - INTERVAL '30 days'
--         )
--     WHERE signal_count > 0;

--     UPDATE pain_clusters SET
--         velocity_trend = CASE
--             WHEN velocity_7d > velocity_30d * 1.5 THEN 'accelerating'
--             WHEN velocity_7d < velocity_30d * 0.5 THEN 'decelerating'
--             ELSE 'stable'
--         END
--     WHERE signal_count > 0;
--     $$
-- );



-- ────────────────────────────────────────────────────────────
-- DONE. Your database is ready.
--
-- Next steps:
-- 1. Copy your Supabase URL + service_role key
-- 2. Set them as environment variables in n8n
-- 3. Build the Scout agent (reddit ingestion)
-- 4. Build the Classifier agent (Claude API)
-- 5. Start scoring
-- ────────────────────────────────────────────────────────────
