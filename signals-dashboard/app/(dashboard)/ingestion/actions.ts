"use server";

import { createClient } from "@/lib/supabase/server";
import {
  ingestRedditForUser,
  type SubredditResult,
} from "@/lib/ingestion/reddit";
import {
  ingestProductHuntLive,
  ingestProductHuntTodaysWinners,
  backfillProductHuntHistorical,
  type PHLiveResult,
  type PHTodayResult,
  type PHBackfillResult,
} from "@/lib/ingestion/producthunt";

// ── Reddit ─────────────────────────────────────────────────

export async function runRedditIngestion(): Promise<
  | { ok: true; results: SubredditResult[]; inserted: number; duplicates: number }
  | { ok: false; error: string }
> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { ok: false, error: "Not logged in" };
    }

    const { results, inserted, duplicates } = await ingestRedditForUser(
      user.id,
    );
    return { ok: true, results, inserted, duplicates };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

// ── Product Hunt: Live ─────────────────────────────────────

export async function runProductHuntLive(): Promise<
  | ({ ok: true } & PHLiveResult)
  | { ok: false; error: string }
> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { ok: false, error: "Not logged in" };
    }

    const result = await ingestProductHuntLive(user.id);
    return { ok: true, ...result };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

// ── Product Hunt: Today ────────────────────────────────────

export async function runProductHuntTodaysWinners(): Promise<
  | ({ ok: true } & PHTodayResult)
  | { ok: false; error: string }
> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { ok: false, error: "Not logged in" };
    }

    const result = await ingestProductHuntTodaysWinners(user.id);
    return { ok: true, ...result };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

// ── Product Hunt: Backfill ─────────────────────────────────

export async function runProductHuntBackfill(): Promise<
  | ({ ok: true } & PHBackfillResult)
  | { ok: false; error: string }
> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { ok: false, error: "Not logged in" };
    }

    const result = await backfillProductHuntHistorical(user.id);
    return { ok: true, ...result };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}
