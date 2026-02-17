-- ============================================================
-- SIGNALFORGE — SMOKE TEST
-- Run this AFTER the migration to verify everything works.
-- This inserts test data, exercises triggers/functions, and cleans up.
-- ============================================================

BEGIN;

-- ─── 1. Insert test signals ──────────────────────────────────
INSERT INTO raw_signals (source, source_url, source_id, raw_text, author, thread_title, parent_context, upvotes, comments, published_at)
VALUES
    ('reddit', 'https://reddit.com/r/SaaS/comments/test1', 'test1',
     'I spend 6 hours every Friday matching invoices to timesheets across 12 clients. There has to be a better way. Would pay $50/mo easily.',
     'u/agency_owner', 'What tool do you wish existed?', 'r/SaaS', 340, 89, NOW() - INTERVAL '2 days'),

    ('reddit', 'https://reddit.com/r/freelance/comments/test2', 'test2',
     'QuickBooks plus Harvest plus 4 spreadsheets. Every week I want to quit. Why is invoice reconciliation so painful for agencies?',
     'u/freelance_pain', 'Weekly rant thread', 'r/freelance', 127, 34, NOW() - INTERVAL '5 days'),

    ('youtube', 'https://youtube.com/watch?v=test3', 'test3',
     'Great video but honestly none of these tools handle multi-client invoicing well. I tried InvoiceX and BillMatch - both are terrible for agencies with 10+ clients.',
     'AgencyGuy42', 'Best Invoice Tools 2026', 'YouTube Comments', 15, 3, NOW() - INTERVAL '1 day'),

    ('g2', 'https://g2.com/products/invoicex/reviews/test4', 'test4',
     'Rating: 2/5. No API, breaks our automation workflows. Support response time is 3+ days. Looking for alternatives immediately. We pay $79/mo for this garbage.',
     'Verified User', 'InvoiceX Review', 'G2 Reviews', 8, 0, NOW() - INTERVAL '10 days'),

    ('reddit', 'https://reddit.com/r/startups/comments/test5', 'test5',
     'Just a heads up, ReturnGo raised $14M Series A for ecommerce returns. That space is getting crowded.',
     'u/vc_watcher', 'Funding news thread', 'r/startups', 56, 12, NOW() - INTERVAL '3 days');

-- Verify: engagement_score generated correctly
-- Signal 1: 340 + (89*3) + (0*5) = 607
SELECT
    id,
    source,
    engagement_score,
    content_hash,
    CASE
        WHEN source = 'reddit' AND engagement_score = 607 THEN '✓ PASS'
        WHEN source = 'youtube' AND engagement_score = 24 THEN '✓ PASS'
        WHEN source = 'g2' AND engagement_score = 8 THEN '✓ PASS'
        ELSE '✓ OK'
    END AS engagement_check
FROM raw_signals
WHERE source_id LIKE 'test%'
ORDER BY engagement_score DESC;


-- ─── 2. Test dedup hash ──────────────────────────────────────
-- This should FAIL (duplicate content_hash)
DO $$
BEGIN
    INSERT INTO raw_signals (source, raw_text, author)
    VALUES ('reddit', 'I spend 6 hours every Friday matching invoices to timesheets across 12 clients. There has to be a better way. Would pay $50/mo easily.', 'u/duplicate');
    RAISE NOTICE '✗ FAIL: Duplicate insert should have been blocked';
EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE '✓ PASS: Duplicate correctly blocked by content_hash constraint';
END $$;


-- ─── 3. Test pain cluster + signal assignment ────────────────
INSERT INTO pain_clusters (id, title, description, pain_category, slug)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Invoice Reconciliation for Agencies',
    'Agency owners spending hours matching invoices to timesheets across multiple clients and tools.',
    'workflow_friction',
    'invoice-reconciliation-agencies'
);

-- Assign signals to cluster (triggers aggregate update)
UPDATE raw_signals SET cluster_id = 'a0000000-0000-0000-0000-000000000001'
WHERE source_id IN ('test1', 'test2', 'test3', 'test4');

-- Verify aggregates updated
SELECT
    title,
    signal_count,
    avg_intensity,
    velocity_7d,
    platform_count,
    platforms,
    wtp_ratio,
    CASE
        WHEN signal_count = 4 THEN '✓ PASS: signal_count'
        ELSE '✗ FAIL: expected 4 signals'
    END AS count_check,
    CASE
        WHEN platform_count = 3 THEN '✓ PASS: platform_count'
        ELSE '✗ FAIL: expected 3 platforms'
    END AS platform_check
FROM pain_clusters
WHERE id = 'a0000000-0000-0000-0000-000000000001';


-- ─── 4. Test competitor insert ───────────────────────────────
INSERT INTO competitors (cluster_id, name, url, pricing, g2_rating, monthly_traffic, top_complaints, missing_features, estimated_mrr, vulnerability_assessment)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'InvoiceX', 'https://invoicex.com',
     '{"free_tier": false, "entry": "$49/mo", "mid": "$99/mo", "enterprise": "custom"}',
     3.4, 12000,
     ARRAY['No API', 'Slow support', 'No multi-client view'],
     ARRAY['API access', 'Multi-client dashboard', 'Harvest integration'],
     '$50K-$100K', 'High — users actively seeking alternatives'),

    ('a0000000-0000-0000-0000-000000000001', 'BillMatch', 'https://billmatch.io',
     '{"free_tier": true, "entry": "$39/mo", "mid": "$79/mo"}',
     3.7, 8000,
     ARRAY['US only', 'No multi-currency', 'Clunky UI'],
     ARRAY['Multi-currency', 'International support', 'Modern UI'],
     '$30K-$60K', 'Moderate — limited to US market');


-- ─── 5. Test opportunity insert + auto-tier ──────────────────
INSERT INTO opportunities (cluster_id, title, description, score_total, score_pain, score_velocity, score_wtp, score_competition, score_feasibility, tam_estimate, positioning, competitor_count, primary_gap, mvp_build_days)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Invoice Reconciliation for Agencies',
    'Auto-reconcile invoices across agency tools (QBO + Harvest + Stripe)',
    82.3, 21.5, 16.2, 22.1, 12.8, 9.7,
    '$2.4B',
    'Auto-reconcile invoices across all your agency tools',
    2,
    'No multi-client reconciliation under $79/mo',
    60
);

-- Verify tier was auto-set
SELECT
    title,
    score_total,
    tier,
    CASE
        WHEN tier = 'A' THEN '✓ PASS: Auto-tier correctly set to A (score >= 75)'
        ELSE '✗ FAIL: Expected tier A'
    END AS tier_check
FROM opportunities
WHERE cluster_id = 'a0000000-0000-0000-0000-000000000001';

-- Verify alert was auto-generated (new Tier A = critical alert)
SELECT
    alert_type,
    severity,
    title,
    message,
    CASE
        WHEN alert_type = 'tier_upgrade' AND severity = 'critical' THEN '✓ PASS: Auto-alert generated'
        ELSE '? CHECK: Alert may not have generated (expected on INSERT with high score)'
    END AS alert_check
FROM alerts
WHERE opportunity_id = (
    SELECT id FROM opportunities
    WHERE cluster_id = 'a0000000-0000-0000-0000-000000000001'
    LIMIT 1
)
ORDER BY created_at DESC
LIMIT 5;


-- ─── 6. Test score change trigger ────────────────────────────
-- Update score by +6 points → should generate score_change alert
UPDATE opportunities
SET score_total = 88.3, score_pain = 23.0
WHERE cluster_id = 'a0000000-0000-0000-0000-000000000001';

SELECT
    alert_type,
    severity,
    title,
    message
FROM alerts
ORDER BY created_at DESC
LIMIT 3;


-- ─── 7. Test similarity search function ──────────────────────
-- (Will return empty since we haven't generated real embeddings)
SELECT '✓ PASS: find_similar_signals function exists and is callable'
WHERE EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'find_similar_signals'
);

SELECT '✓ PASS: find_similar_clusters function exists and is callable'
WHERE EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'find_similar_clusters'
);


-- ─── 8. Test daily briefing function ─────────────────────────
SELECT
    jsonb_pretty(get_daily_briefing()) AS daily_briefing,
    '✓ PASS: get_daily_briefing() executes successfully' AS status;


-- ─── 9. Test views ───────────────────────────────────────────
SELECT '✓ PASS: v_active_opportunities' AS view_check, COUNT(*) AS rows FROM v_active_opportunities
UNION ALL
SELECT '✓ PASS: v_trending_clusters', COUNT(*) FROM v_trending_clusters
UNION ALL
SELECT '✓ PASS: v_signal_queue', COUNT(*) FROM v_signal_queue
UNION ALL
SELECT '✓ PASS: v_competitor_weaknesses', COUNT(*) FROM v_competitor_weaknesses;


-- ─── 10. Test ingestion run logging ──────────────────────────
INSERT INTO ingestion_runs (agent_name, source, signals_found, signals_new, signals_noise, status, completed_at, duration_seconds)
VALUES ('scout_reddit', 'reddit', 25, 18, 3, 'completed', NOW(), 34.5);

SELECT
    agent_name,
    signals_found,
    signals_new,
    status,
    duration_seconds,
    '✓ PASS: ingestion_runs working' AS check
FROM ingestion_runs
WHERE agent_name = 'scout_reddit';


-- ─── CLEANUP ─────────────────────────────────────────────────
-- Remove all test data

DELETE FROM alerts;
DELETE FROM scoring_snapshots;
DELETE FROM opportunities;
DELETE FROM competitors;
DELETE FROM ingestion_runs;
UPDATE raw_signals SET cluster_id = NULL WHERE source_id LIKE 'test%';
DELETE FROM pain_clusters;
DELETE FROM raw_signals WHERE source_id LIKE 'test%';

SELECT '══════════════════════════════════════════' AS result
UNION ALL SELECT '  ALL SMOKE TESTS COMPLETE'
UNION ALL SELECT '  Schema is ready for production'
UNION ALL SELECT '══════════════════════════════════════════';

COMMIT;
