-- ============================================================
-- Pipeline Health Report — RPC function
-- Returns a JSONB diagnostic report scoped to a single owner.
-- ============================================================

CREATE OR REPLACE FUNCTION public.pipeline_health_report(p_owner_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ingestion   jsonb;
  v_raw_counts  jsonb;
  v_raw_24h     jsonb;
  v_reddit_null bigint;
  v_reddit_dups jsonb;
  v_opp_total   bigint;
  v_opp_scored  bigint;
  v_opp_verdict bigint;
  v_opp_status  jsonb;
  v_owner_check bigint;
  v_flags       jsonb := '[]'::jsonb;
  v_result      jsonb;
BEGIN
  -- ── a) ingestion_state (live modes) ────────────────────────
  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.updated_at DESC), '[]'::jsonb)
  INTO v_ingestion
  FROM (
    SELECT source::text, mode, last_success_at, updated_at
    FROM   ingestion_state
    WHERE  owner_id = p_owner_id
  ) t;

  -- ── b) raw_signals counts by source ────────────────────────
  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  INTO v_raw_counts
  FROM (
    SELECT source::text, count(*) AS total
    FROM   raw_signals
    WHERE  owner_id = p_owner_id
    GROUP  BY source
    ORDER  BY total DESC
  ) t;

  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  INTO v_raw_24h
  FROM (
    SELECT source::text, count(*) AS rows_last_24h
    FROM   raw_signals
    WHERE  owner_id = p_owner_id
      AND  created_at > now() - interval '24 hours'
    GROUP  BY source
    ORDER  BY rows_last_24h DESC
  ) t;

  -- ── c) reddit dedupe integrity ─────────────────────────────
  SELECT count(*)
  INTO v_reddit_null
  FROM raw_signals
  WHERE owner_id = p_owner_id
    AND source = 'reddit'
    AND source_id IS NULL;

  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  INTO v_reddit_dups
  FROM (
    SELECT source_id, count(*) AS cnt
    FROM   raw_signals
    WHERE  owner_id = p_owner_id
      AND  source = 'reddit'
    GROUP  BY source_id
    HAVING count(*) > 1
    ORDER  BY cnt DESC
    LIMIT  25
  ) t;

  -- ── d) opportunities pipeline counts ───────────────────────
  -- opportunities has no owner_id; count all rows (single-tenant)
  SELECT count(*) INTO v_opp_total   FROM opportunities;
  SELECT count(*) INTO v_opp_scored  FROM opportunities WHERE score_total IS NOT NULL;
  SELECT count(*) INTO v_opp_verdict FROM scoring_snapshots WHERE verdict IS NOT NULL;

  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  INTO v_opp_status
  FROM (
    SELECT status::text, count(*) AS cnt
    FROM   opportunities
    GROUP  BY status
    ORDER  BY cnt DESC
  ) t;

  -- ── e) owner sanity ────────────────────────────────────────
  SELECT count(DISTINCT owner_id)
  INTO v_owner_check
  FROM raw_signals
  WHERE owner_id = p_owner_id;

  -- ── Compute flags ──────────────────────────────────────────
  IF v_reddit_null > 0 THEN
    v_flags := v_flags || jsonb_build_array(jsonb_build_object(
      'code', 'REDDIT_SOURCE_ID_NULL',
      'severity', 'error',
      'message', v_reddit_null || ' Reddit rows have no source_id — dedup is broken for those rows.'
    ));
  END IF;

  IF jsonb_array_length(v_reddit_dups) > 0 THEN
    v_flags := v_flags || jsonb_build_array(jsonb_build_object(
      'code', 'REDDIT_DUPLICATES',
      'severity', 'error',
      'message', jsonb_array_length(v_reddit_dups) || ' Reddit source_id values appear more than once.'
    ));
  END IF;

  -- Check if all 24h counts are zero while ingestion updated recently
  IF jsonb_array_length(v_raw_24h) = 0
     AND jsonb_array_length(v_ingestion) > 0 THEN
    v_flags := v_flags || jsonb_build_array(jsonb_build_object(
      'code', 'NO_SIGNALS_24H',
      'severity', 'warn',
      'message', 'Zero signals collected in the last 24 hours even though ingestion state exists. Possible filtering issue.'
    ));
  END IF;

  IF v_opp_total = 0 THEN
    v_flags := v_flags || jsonb_build_array(jsonb_build_object(
      'code', 'NO_OPPORTUNITIES',
      'severity', 'warn',
      'message', 'No opportunities exist yet — the pipeline has not advanced downstream.'
    ));
  END IF;

  IF v_owner_check = 0 AND jsonb_array_length(v_ingestion) > 0 THEN
    v_flags := v_flags || jsonb_build_array(jsonb_build_object(
      'code', 'OWNER_NO_SIGNALS',
      'severity', 'warn',
      'message', 'Ingestion state exists but no raw_signals found for this owner.'
    ));
  END IF;

  -- ── Assemble result ────────────────────────────────────────
  v_result := jsonb_build_object(
    'generated_at',              now(),
    'owner_id',                  p_owner_id,
    'ingestion_state',           v_ingestion,
    'raw_counts',                v_raw_counts,
    'raw_counts_last_24h',       v_raw_24h,
    'reddit_null_source_id_count', v_reddit_null,
    'reddit_duplicates',         v_reddit_dups,
    'opportunities', jsonb_build_object(
      'total',       v_opp_total,
      'with_score',  v_opp_scored,
      'with_verdict', v_opp_verdict,
      'by_status',   v_opp_status
    ),
    'flags', v_flags
  );

  RETURN v_result;
END;
$$;

-- Allow authenticated + service role to call the function
GRANT EXECUTE ON FUNCTION public.pipeline_health_report(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pipeline_health_report(uuid) TO service_role;
