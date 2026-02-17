-- ============================================================
-- SIGNALFORGE — SQL CHEAT SHEET
-- Copy-paste queries for n8n workflows and debugging.
-- ============================================================

-- ═══════════════════════════════════════════════════════════
-- INGESTION (Scout Agent)
-- ═══════════════════════════════════════════════════════════

-- Insert new signal (returns the row for pipeline chaining)
INSERT INTO raw_signals (source, source_url, source_id, raw_text, author,
    thread_title, parent_context, upvotes, comments, shares, published_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
ON CONFLICT (content_hash) DO NOTHING
RETURNING id, content_hash;

-- Check if signal already exists (before generating embedding)
SELECT EXISTS(
    SELECT 1 FROM raw_signals WHERE content_hash = md5(lower(trim($1)))
) AS already_exists;

-- Log ingestion run
INSERT INTO ingestion_runs (agent_name, source, signals_found, signals_new, signals_noise, status, completed_at, duration_seconds)
VALUES ($1, $2, $3, $4, $5, 'completed', NOW(), $6);


-- ═══════════════════════════════════════════════════════════
-- CLASSIFICATION (Classifier Agent)
-- ═══════════════════════════════════════════════════════════

-- Get batch of unprocessed signals (for LLM classification)
SELECT id, source, raw_text, thread_title, parent_context,
       engagement_score, published_at
FROM raw_signals
WHERE is_processed = FALSE
ORDER BY engagement_score DESC
LIMIT 20;

-- Update signal with classification results
UPDATE raw_signals SET
    is_processed = TRUE,
    pain_category = $2,
    intensity = $3,
    specificity = $4,
    wtp = $5,
    budget_mentioned = $6,
    tools_mentioned = $7,
    existing_workarounds = $8,
    target_persona = $9,
    suggested_niche = $10,
    is_noise = $11,
    classification = $12    -- full JSON from LLM
WHERE id = $1;

-- Store embedding for a signal
UPDATE raw_signals SET embedding = $2 WHERE id = $1;


-- ═══════════════════════════════════════════════════════════
-- DEDUP & CLUSTERING
-- ═══════════════════════════════════════════════════════════

-- Semantic dedup: find similar existing signals
SELECT * FROM find_similar_signals($1::vector(1536), 0.87, 5);

-- Find matching cluster for a new signal
SELECT * FROM find_similar_clusters($1::vector(1536), 0.82, 3);

-- Assign signal to existing cluster
UPDATE raw_signals SET cluster_id = $2 WHERE id = $1;

-- Create new cluster and assign signal
WITH new_cluster AS (
    INSERT INTO pain_clusters (title, description, pain_category, centroid)
    VALUES ($1, $2, $3, $4::vector(1536))
    RETURNING id
)
UPDATE raw_signals SET cluster_id = (SELECT id FROM new_cluster)
WHERE id = $5;

-- Manually refresh cluster aggregates
SELECT update_cluster_aggregates($1);


-- ═══════════════════════════════════════════════════════════
-- COMPETITOR INTEL
-- ═══════════════════════════════════════════════════════════

-- Upsert competitor (update if exists for same cluster + url)
INSERT INTO competitors (cluster_id, name, url, pricing, g2_rating,
    g2_review_count, monthly_traffic, traffic_trend, top_complaints,
    missing_features, estimated_mrr, vulnerability_assessment, confidence)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
ON CONFLICT (cluster_id, url) DO UPDATE SET
    pricing = EXCLUDED.pricing,
    g2_rating = EXCLUDED.g2_rating,
    monthly_traffic = EXCLUDED.monthly_traffic,
    traffic_trend = EXCLUDED.traffic_trend,
    top_complaints = EXCLUDED.top_complaints,
    missing_features = EXCLUDED.missing_features,
    estimated_mrr = EXCLUDED.estimated_mrr,
    vulnerability_assessment = EXCLUDED.vulnerability_assessment,
    confidence = EXCLUDED.confidence,
    last_updated = NOW();

-- Get all competitors for a cluster
SELECT name, url, pricing, g2_rating, monthly_traffic,
       top_complaints, missing_features, estimated_mrr, vulnerability_assessment
FROM competitors
WHERE cluster_id = $1
ORDER BY monthly_traffic DESC NULLS LAST;


-- ═══════════════════════════════════════════════════════════
-- SCORING (Scorer Agent)
-- ═══════════════════════════════════════════════════════════

-- Get clusters ready for scoring (enough signals + has competitors)
SELECT
    pc.id,
    pc.title,
    pc.signal_count,
    pc.avg_intensity,
    pc.velocity_7d,
    pc.velocity_30d,
    pc.velocity_trend,
    pc.wtp_ratio,
    pc.avg_budget_mentioned,
    pc.platform_count,
    (SELECT COUNT(*) FROM competitors c WHERE c.cluster_id = pc.id) AS competitor_count,
    (SELECT AVG(g2_rating) FROM competitors c WHERE c.cluster_id = pc.id) AS avg_competitor_rating
FROM pain_clusters pc
WHERE pc.signal_count >= 10
  AND EXISTS (SELECT 1 FROM competitors c WHERE c.cluster_id = pc.id)
  AND NOT EXISTS (
      SELECT 1 FROM opportunities o
      WHERE o.cluster_id = pc.id
        AND o.updated_at > NOW() - INTERVAL '7 days'
  )
ORDER BY pc.velocity_7d DESC;

-- Upsert opportunity score
INSERT INTO opportunities (cluster_id, title, description,
    score_total, score_pain, score_velocity, score_wtp,
    score_competition, score_feasibility,
    tam_estimate, positioning, competitor_count, primary_gap, mvp_build_days)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
ON CONFLICT (cluster_id)
    WHERE status NOT IN ('killed', 'launched')
DO UPDATE SET
    score_total = EXCLUDED.score_total,
    score_pain = EXCLUDED.score_pain,
    score_velocity = EXCLUDED.score_velocity,
    score_wtp = EXCLUDED.score_wtp,
    score_competition = EXCLUDED.score_competition,
    score_feasibility = EXCLUDED.score_feasibility,
    competitor_count = EXCLUDED.competitor_count,
    updated_at = NOW();
-- Note: This won't work with ON CONFLICT as-is because cluster_id
-- isn't unique. Use the pattern below instead:

-- Better: Check-then-update pattern
UPDATE opportunities SET
    score_total = $2, score_pain = $3, score_velocity = $4,
    score_wtp = $5, score_competition = $6, score_feasibility = $7,
    competitor_count = $8
WHERE cluster_id = $1 AND status NOT IN ('killed', 'launched');


-- ═══════════════════════════════════════════════════════════
-- DAILY BRIEFING (Scribe Agent)
-- ═══════════════════════════════════════════════════════════

-- Get the full daily briefing
SELECT get_daily_briefing();

-- Mark alerts as delivered
UPDATE alerts SET delivered_slack = TRUE, delivered_email = TRUE
WHERE delivered_email = FALSE
RETURNING id, alert_type, severity, title, message;

-- Get top opportunities for briefing email
SELECT * FROM v_active_opportunities
WHERE tier IN ('A', 'B')
LIMIT 10;

-- Get trending/accelerating clusters
SELECT * FROM v_trending_clusters LIMIT 10;


-- ═══════════════════════════════════════════════════════════
-- VALIDATION LOOP
-- ═══════════════════════════════════════════════════════════

-- Advance validation stage
UPDATE opportunities SET
    validation_stage = $2,
    updated_at = NOW()
WHERE id = $1;

-- Record landing page results
UPDATE opportunities SET
    landing_page_url = $2,
    landing_page_signup_rate = $3,
    validation_stage = CASE
        WHEN $3 >= 0.05 THEN 'survey'      -- passed: >=5% signup
        ELSE 'killed'                        -- failed
    END,
    kill_reason = CASE WHEN $3 < 0.05 THEN 'Landing page signup rate below 5%' END,
    killed_at = CASE WHEN $3 < 0.05 THEN NOW() END
WHERE id = $1;

-- Kill an opportunity
UPDATE opportunities SET
    status = 'killed',
    kill_reason = $2,
    killed_at = NOW()
WHERE id = $1;


-- ═══════════════════════════════════════════════════════════
-- MONITORING & DEBUGGING
-- ═══════════════════════════════════════════════════════════

-- Signal ingestion stats (last 24 hours)
SELECT
    source,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE is_noise = FALSE) AS valid,
    COUNT(*) FILTER (WHERE is_noise = TRUE) AS noise,
    COUNT(*) FILTER (WHERE is_processed = TRUE) AS classified,
    AVG(engagement_score) AS avg_engagement
FROM raw_signals
WHERE ingested_at > NOW() - INTERVAL '24 hours'
GROUP BY source
ORDER BY total DESC;

-- Cluster health check
SELECT
    title,
    signal_count,
    velocity_7d,
    velocity_trend,
    avg_intensity,
    wtp_ratio,
    platform_count,
    last_seen,
    CASE
        WHEN velocity_trend = 'accelerating' THEN '🔥'
        WHEN velocity_trend = 'stable' THEN '→'
        ELSE '↓'
    END AS trend_icon
FROM pain_clusters
WHERE signal_count >= 5
ORDER BY velocity_7d DESC
LIMIT 20;

-- Database size check
SELECT
    relname AS table_name,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
    n_live_tup AS row_count
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

-- Recent agent runs
SELECT
    agent_name,
    source,
    signals_found,
    signals_new,
    signals_noise,
    duration_seconds,
    status,
    started_at
FROM ingestion_runs
ORDER BY started_at DESC
LIMIT 10;

-- WTP signal analysis
SELECT
    suggested_niche,
    COUNT(*) AS signal_count,
    COUNT(*) FILTER (WHERE wtp = 'explicit') AS explicit_wtp,
    COUNT(*) FILTER (WHERE wtp = 'proven') AS proven_wtp,
    AVG(budget_mentioned) FILTER (WHERE budget_mentioned IS NOT NULL) AS avg_budget,
    MAX(budget_mentioned) AS max_budget
FROM raw_signals
WHERE is_noise = FALSE AND wtp IN ('explicit', 'proven')
GROUP BY suggested_niche
HAVING COUNT(*) >= 3
ORDER BY COUNT(*) DESC;
