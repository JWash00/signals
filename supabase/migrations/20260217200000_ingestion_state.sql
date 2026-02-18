-- ────────────────────────────────────────────────────────────
-- Ingestion State — track per-source, per-mode cursors and
-- last-success timestamps so cron runs don't replay items.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ingestion_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    mode TEXT NOT NULL,
    last_success_at TIMESTAMPTZ,
    cursor TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(owner_id, source, mode)
);

CREATE INDEX IF NOT EXISTS idx_ingestion_state_owner
    ON ingestion_state (owner_id);

-- RLS
ALTER TABLE ingestion_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select" ON ingestion_state
    FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "owner_insert" ON ingestion_state
    FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner_update" ON ingestion_state
    FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner_delete" ON ingestion_state
    FOR DELETE USING (owner_id = auth.uid());
