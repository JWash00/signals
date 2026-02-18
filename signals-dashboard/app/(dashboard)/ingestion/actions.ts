"use server";

import { createClient } from "@/lib/supabase/server";
import {
  ingestRedditForUser,
  type SubredditResult,
} from "@/lib/ingestion/reddit";

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
