-- ============================================================
-- Pipeline Health Report v2 — RPC function
-- Returns a JSONB diagnostic report scoped to a single owner.
-- Kid-readable flags. Covers robots, collection, honesty,
-- decide counts, pain groups, big ideas.
-- ============================================================

CREATE OR REPLACE FUNCTION public.pipeline_health_report(p_owner_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_ingestion jsonb;
  v_raw_total jsonb;
  v_raw_24h jsonb;
  v_reddit_null int := 0;
  v_reddit_dupes jsonb := '[]'::jsonb;

  v_new_count int := 0;
  v_approved_count int := 0;
  v_rejected_count int := 0;

  v_pain_groups_total int := 0;
  v_big_ideas_total int := 0;
  v_big_ideas_scored int := 0;
  v_big_ideas_decided int := 0;
  v_avg_score numeric := null;

  v_flags jsonb := '[]'::jsonb;
BEGIN
  -- 1) Are the robots running? (ingestion_state)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'source', source,
      'mode', mode,
      'last_success_at', last_success_at,
      'updated_at', updated_at
    )
    ORDER BY updated_at DESC
  ), '[]'::jsonb)
  INTO v_ingestion
  FROM public.ingestion_state
  WHERE owner_id = p_owner_id;

  -- 2) Total New Finds by source
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('source', source, 'count', cnt)
    ORDER BY cnt DESC
  ), '[]'::jsonb)
  INTO v_raw_total
  FROM (
    SELECT source, count(*)::int as cnt
    FROM public.raw_signals
    WHERE owner_id = p_owner_id
    GROUP BY source
  ) t;

  -- 3) New Finds last 24 hours by source
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('source', source, 'count', cnt)
    ORDER BY cnt DESC
  ), '[]'::jsonb)
  INTO v_raw_24h
  FROM (
    SELECT source, count(*)::int as cnt
    FROM public.raw_signals
    WHERE owner_id = p_owner_id
      AND created_at > (v_now - interval '24 hours')
    GROUP BY source
  ) t;

  -- 4) Reddit integrity checks
  SELECT count(*)::int
  INTO v_reddit_null
  FROM public.raw_signals
  WHERE owner_id = p_owner_id
    AND source = 'reddit'
    AND source_id IS NULL;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('source_id', source_id, 'count', cnt)
  ), '[]'::jsonb)
  INTO v_reddit_dupes
  FROM (
    SELECT source_id, count(*)::int as cnt
    FROM public.raw_signals
    WHERE owner_id = p_owner_id
      AND source = 'reddit'
    GROUP BY source_id
    HAVING count(*) > 1
  ) d;

  -- 5) Decide counts (new/approved/rejected from raw_signals.status)
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'raw_signals'
      AND column_name = 'status'
  ) THEN
    EXECUTE format(
      'SELECT count(*) FILTER (WHERE status = ''new'')::int, '
      || 'count(*) FILTER (WHERE status = ''approved'')::int, '
      || 'count(*) FILTER (WHERE status = ''rejected'')::int '
      || 'FROM public.raw_signals WHERE owner_id = $1'
    ) INTO v_new_count, v_approved_count, v_rejected_count
    USING p_owner_id;
  END IF;

  -- 6) Pain Groups count (pain_clusters — single-tenant, no owner_id)
  SELECT count(*)::int
  INTO v_pain_groups_total
  FROM public.pain_clusters;

  -- 7) Big Ideas counts (opportunities — single-tenant, no owner_id)
  --    "decided" = status moved past the default 'scored' state
  SELECT
    count(*)::int,
    count(*) FILTER (WHERE score_total IS NOT NULL)::int,
    count(*) FILTER (WHERE status IS NOT NULL AND status != 'scored')::int,
    avg(score_total) FILTER (WHERE score_total IS NOT NULL)
  INTO v_big_ideas_total, v_big_ideas_scored, v_big_ideas_decided, v_avg_score
  FROM public.opportunities;

  -- 8) FLAGS (kid-readable problems)
  IF v_reddit_null > 0 THEN
    v_flags := v_flags || jsonb_build_object(
      'level', 'bad',
      'code', 'REDDIT_MISSING_ID',
      'message', 'Reddit New Finds are missing an ID. This can cause duplicates.'
    );
  END IF;

  IF jsonb_array_length(v_reddit_dupes) > 0 THEN
    v_flags := v_flags || jsonb_build_object(
      'level', 'bad',
      'code', 'REDDIT_DUPES',
      'message', 'Reddit has duplicate New Finds. The system may be repeating itself.'
    );
  END IF;

  IF jsonb_array_length(v_raw_24h) = 0
     AND jsonb_array_length(v_ingestion) > 0 THEN
    v_flags := v_flags || jsonb_build_object(
      'level', 'ok',
      'code', 'NO_SIGNALS_24H',
      'message', 'Nothing was collected in the last 24 hours. That can be normal on weekends.'
    );
  END IF;

  IF v_big_ideas_total = 0 THEN
    v_flags := v_flags || jsonb_build_object(
      'level', 'ok',
      'code', 'NO_BIG_IDEAS_YET',
      'message', 'No Big Ideas yet. Approve more New Finds and the system will make them automatically.'
    );
  END IF;

  RETURN jsonb_build_object(
    'generated_at', v_now,
    'owner_id', p_owner_id,

    'robots_running', jsonb_build_object(
      'ingestion_state', v_ingestion
    ),

    'collected', jsonb_build_object(
      'new_finds_total_by_source', v_raw_total,
      'new_finds_last_24h_by_source', v_raw_24h
    ),

    'honesty_checks', jsonb_build_object(
      'reddit_missing_id_count', v_reddit_null,
      'reddit_duplicates', v_reddit_dupes
    ),

    'decide_counts', jsonb_build_object(
      'new', v_new_count,
      'approved', v_approved_count,
      'rejected', v_rejected_count
    ),

    'pain_groups', jsonb_build_object(
      'total', v_pain_groups_total
    ),

    'big_ideas', jsonb_build_object(
      'total', v_big_ideas_total,
      'scored', v_big_ideas_scored,
      'decided', v_big_ideas_decided,
      'avg_score', v_avg_score
    ),

    'flags', v_flags
  );
END;
$$;

-- Allow logged-in users to call it for themselves
GRANT EXECUTE ON FUNCTION public.pipeline_health_report(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pipeline_health_report(uuid) TO service_role;
