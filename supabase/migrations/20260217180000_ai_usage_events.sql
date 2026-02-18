-- ────────────────────────────────────────────────────────────
-- AI Usage Events — track token spend per user
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    event TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    total_tokens INTEGER,
    opportunity_id UUID,
    cluster_id UUID,
    raw_signal_id UUID,
    meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_usage_owner_date ON ai_usage_events (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_event_date ON ai_usage_events (event, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_opportunity ON ai_usage_events (opportunity_id);

-- RLS
ALTER TABLE ai_usage_events ENABLE ROW LEVEL SECURITY;

-- Separate per-operation policies
CREATE POLICY "owner_select" ON ai_usage_events
    FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "owner_insert" ON ai_usage_events
    FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner_update" ON ai_usage_events
    FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner_delete" ON ai_usage_events
    FOR DELETE
    USING (owner_id = auth.uid());
