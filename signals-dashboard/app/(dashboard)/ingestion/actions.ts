"use server";

import { createClient } from "@/lib/supabase/server";
import { ingestRedditForUser } from "@/lib/ingestion/reddit";

export async function runRedditIngestion(): Promise<
  { ok: true; inserted: number; skipped: number } | { ok: false; error: string }
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

    const { inserted, skipped } = await ingestRedditForUser(user.id);
    return { ok: true, inserted, skipped };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
