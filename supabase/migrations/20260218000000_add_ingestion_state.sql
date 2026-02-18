-- ────────────────────────────────────────────────────────────
-- ingestion_state — per-source, per-mode watermarks so
-- ingestion runs never replay the same items.
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.ingestion_state (
    owner_id        uuid            NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source          signal_source   NOT NULL,
    mode            text            NOT NULL CHECK (mode IN ('live', 'today', 'backfill')),
    cursor          text,
    last_success_at timestamptz,
    meta            jsonb           NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz     NOT NULL DEFAULT now(),
    updated_at      timestamptz     NOT NULL DEFAULT now(),

    PRIMARY KEY (owner_id, source, mode)
);

-- ── Trigger: auto-update updated_at ────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ingestion_state_updated_at
    BEFORE UPDATE ON public.ingestion_state
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Row Level Security ─────────────────────────────────────

ALTER TABLE public.ingestion_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ingestion_state_select"
    ON public.ingestion_state FOR SELECT
    TO authenticated
    USING (owner_id = auth.uid());

CREATE POLICY "ingestion_state_insert"
    ON public.ingestion_state FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "ingestion_state_update"
    ON public.ingestion_state FOR UPDATE
    TO authenticated
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "ingestion_state_delete"
    ON public.ingestion_state FOR DELETE
    TO authenticated
    USING (owner_id = auth.uid());
