-- ────────────────────────────────────────────────────────────
-- ONE-TIME CLEANUP: Remove broken Product Hunt rows with NULL source_id.
--
-- The unique index raw_signals_owner_source_source_id_unique on
-- (owner_id, source, source_id) does NOT prevent multiple NULLs.
-- These rows were inserted by a bug (now fixed) that did not map
-- the Product Hunt GraphQL node.id into source_id.
--
-- HOW TO RUN:
--   1. Open Supabase Dashboard → SQL Editor
--   2. Paste this file's contents
--   3. Click "Run"
--   4. Verify with the SELECT below — expected: 0
-- ────────────────────────────────────────────────────────────

-- Preview what will be deleted (run this first to confirm):
SELECT id, source, source_id, title, created_at
FROM public.raw_signals
WHERE source IN ('producthunt', 'product_hunt')
  AND source_id IS NULL;

-- Delete the broken rows:
DELETE FROM public.raw_signals
WHERE source IN ('producthunt', 'product_hunt')
  AND source_id IS NULL;

-- Verify — should return 0:
SELECT count(*) AS null_source_id_remaining
FROM public.raw_signals
WHERE source IN ('producthunt', 'product_hunt')
  AND source_id IS NULL;
