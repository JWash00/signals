"use server";

import { createClient } from "@/lib/supabase/server";
import {
  ingestRedditForUser,
  type SubredditResult,
} from "@/lib/ingestion/reddit";
import {
  ingestProductHuntLatest,
  ingestProductHuntLive,
  ingestProductHuntTodaysWinners,
  backfillProductHuntHistorical,
} from "@/lib/ingestion/producthunt";

export async function runRedditIngestion(): Promise<
  | { ok: true; results: SubredditResult[]; inserted: number; skipped: number }
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

    const { results, inserted, skipped } = await ingestRedditForUser(user.id);
    return { ok: true, results, inserted, skipped };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function runProductHuntIngestion(): Promise<
  | { ok: true; inserted: number; skipped: number }
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

    const { inserted, skipped } = await ingestProductHuntLatest(user.id);
    return { ok: true, inserted, skipped };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function runProductHuntLive(): Promise<
  | {
      ok: true;
      inserted: number;
      skipped: number;
      invalid: number;
      fetched: number;
      mode: "LIVE";
      windowLabel: string;
    }
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
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function runProductHuntTodaysWinners(): Promise<
  | {
      ok: true;
      inserted: number;
      skipped: number;
      invalid: number;
      fetched: number;
      mode: "TODAY";
      windowLabel: string;
      note?: string;
    }
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
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function runProductHuntBackfill(): Promise<
  | {
      ok: true;
      inserted: number;
      skipped: number;
      invalid: number;
      fetched: number;
      mode: "BACKFILL";
      windowLabel: string;
      pagesRun: number;
      backfillComplete: boolean;
    }
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
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
