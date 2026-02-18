import type { SupabaseClient } from "@supabase/supabase-js";

export interface IngestionStateRow {
  cursor: string | null;
  last_success_at: string | null;
  meta: Record<string, unknown>;
}

/**
 * Read ingestion state for a (owner, source, mode) tuple.
 * Returns null if no row exists or on error.
 * Never throws.
 */
export async function getIngestionState(
  supabase: SupabaseClient,
  ownerId: string,
  source: string,
  mode: string,
): Promise<IngestionStateRow | null> {
  try {
    const { data, error } = await supabase
      .from("ingestion_state")
      .select("cursor, last_success_at")
      .eq("owner_id", ownerId)
      .eq("source", source)
      .eq("mode", mode)
      .maybeSingle();

    if (error) {
      console.error(
        `[ingestion_state] read failed source=${source} mode=${mode}:`,
        error.message,
        error.code,
      );
      return null;
    }

    if (!data) return null;

    return {
      cursor: data.cursor ?? null,
      last_success_at: data.last_success_at ?? null,
      meta: {},
    };
  } catch (e) {
    console.error("[ingestion_state] read exception:", e);
    return null;
  }
}

/**
 * Upsert ingestion state for a (owner, source, mode) tuple.
 *
 * Only the fields present in `patch` are written.
 * - LIVE: pass { last_success_at, cursor, meta }
 * - BACKFILL: pass { cursor, meta } (no last_success_at)
 * - TODAY: pass { last_success_at, meta } (no cursor)
 *
 * Never throws.
 */
export async function upsertIngestionState(
  supabase: SupabaseClient,
  ownerId: string,
  source: string,
  mode: string,
  patch: {
    cursor?: string | null;
    last_success_at?: string;
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const row: Record<string, unknown> = {
      owner_id: ownerId,
      source,
      mode,
    };
    if (patch.cursor !== undefined) row.cursor = patch.cursor;
    if (patch.last_success_at !== undefined)
      row.last_success_at = patch.last_success_at;
    // Note: meta column does not exist in the actual DB table.
    // Callers may pass it, but we intentionally skip writing it.

    const { error } = await supabase
      .from("ingestion_state")
      .upsert(row, { onConflict: "owner_id,source,mode" });

    if (error) {
      console.error(
        `[ingestion_state] write failed source=${source} mode=${mode}:`,
        error.message,
        error.code,
      );
    }
  } catch (e) {
    console.error("[ingestion_state] write exception:", e);
  }
}
