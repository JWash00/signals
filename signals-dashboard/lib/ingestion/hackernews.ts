import { createServiceClient } from "@/lib/supabase/service";
import {
  getIngestionState,
  upsertIngestionState,
} from "@/lib/ingestion/ingestionState";

// ── Types ──────────────────────────────────────────────────

interface HNItem {
  id: number;
  type: string;
  title?: string;
  text?: string;
  url?: string;
  score?: number;
  descendants?: number; // comment count
  by?: string;
  time?: number; // Unix epoch seconds
}

export interface HNCronResult {
  fetched: number;
  inserted: number;
  duplicates: number;
  skippedOld: number;
  skippedInvalid: number;
  windowStart: string;
}

// ── Helpers ────────────────────────────────────────────────

const HN_BASE = "https://hacker-news.firebaseio.com/v0";
const CONCURRENCY = 10;

/** Fetch a single HN item by ID. Returns null on error. */
async function fetchItem(id: number): Promise<HNItem | null> {
  try {
    const res = await fetch(`${HN_BASE}/item/${id}.json`);
    if (!res.ok) return null;
    return (await res.json()) as HNItem;
  } catch {
    return null;
  }
}

/** Fetch items in batches with concurrency limit. */
async function fetchItemsBatched(
  ids: number[],
  concurrency: number,
): Promise<(HNItem | null)[]> {
  const results: (HNItem | null)[] = new Array(ids.length).fill(null);

  for (let i = 0; i < ids.length; i += concurrency) {
    const batch = ids.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fetchItem));
    for (let j = 0; j < batchResults.length; j++) {
      results[i + j] = batchResults[j];
    }
  }

  return results;
}

// ── Main cron function ────────────────────────────────────

/**
 * Cron-safe Hacker News LIVE ingestion.
 * Fetches up to 200 newest story IDs from the Firebase API,
 * resolves each item (concurrency-limited), filters by time window,
 * and inserts into raw_signals.
 *
 * Uses service-role client (no cookies/auth).
 * Reads ingestion_state source='hacker_news', mode='live' for windowStart.
 * Only updates last_success_at after a successful run (runSucceeded gate).
 */
export async function ingestHNLiveCron(
  ownerId: string,
): Promise<HNCronResult> {
  const supabase = createServiceClient();

  // ── Read state ────────────────────────────────────────────
  const state = await getIngestionState(
    supabase,
    ownerId,
    "hacker_news",
    "live",
  );
  const now = new Date();
  const windowStart = state?.last_success_at
    ? new Date(state.last_success_at)
    : new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const windowStartEpoch = windowStart.getTime() / 1000;

  // ── Fetch newest story IDs ────────────────────────────────
  const idsRes = await fetch(`${HN_BASE}/newstories.json`);
  if (!idsRes.ok) {
    throw new Error(`HN newstories fetch failed: ${idsRes.status}`);
  }
  const allIds: number[] = await idsRes.json();
  const storyIds = allIds.slice(0, 200);

  // ── Resolve items with concurrency limit ──────────────────
  const items = await fetchItemsBatched(storyIds, CONCURRENCY);

  let fetched = 0;
  let inserted = 0;
  let duplicates = 0;
  let skippedOld = 0;
  let skippedInvalid = 0;
  let runSucceeded = true;

  for (const item of items) {
    if (!item) continue;
    if (item.type !== "story") continue;

    // Filter by time window
    if (item.time && item.time <= windowStartEpoch) {
      skippedOld++;
      continue;
    }

    fetched++;

    if (!item.title) {
      skippedInvalid++;
      continue;
    }

    const score = Number(item.score ?? 0);
    const comments = Number(item.descendants ?? 0);
    const safeScore =
      typeof score === "number" && Number.isFinite(score) ? score : 0;
    const safeComments =
      typeof comments === "number" && Number.isFinite(comments) ? comments : 0;

    const sourceUrl =
      item.url || `https://news.ycombinator.com/item?id=${item.id}`;

    const row = {
      owner_id: ownerId,
      source: "hacker_news",
      source_id: String(item.id),
      source_url: sourceUrl,
      title: item.title,
      content: item.text ?? "",
      engagement_proxy: safeScore,
      metadata: {
        hn_id: item.id,
        by: item.by ?? null,
        time: item.time ?? null,
        score: safeScore,
        comments: safeComments,
        external_url: item.url ?? null,
        hn_mode: "LIVE",
        hn_window: windowStart.toISOString(),
      },
      status: "new",
    };

    const { error } = await supabase.from("raw_signals").insert(row);

    if (error) {
      if (error.code === "23505") {
        duplicates++;
      } else {
        console.error(
          `[hn-cron] insert error ${item.id}:`,
          error.message,
        );
        runSucceeded = false;
      }
    } else {
      inserted++;
    }
  }

  // ── Success-gated state write ─────────────────────────────
  if (runSucceeded) {
    await upsertIngestionState(supabase, ownerId, "hacker_news", "live", {
      last_success_at: now.toISOString(),
    });
  }

  console.log(
    `[hn-cron] done | fetched=${fetched} inserted=${inserted} duplicates=${duplicates} skippedOld=${skippedOld} invalid=${skippedInvalid}`,
  );

  return {
    fetched,
    inserted,
    duplicates,
    skippedOld,
    skippedInvalid,
    windowStart: windowStart.toISOString(),
  };
}
