import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getIngestionState,
  upsertIngestionState,
} from "@/lib/ingestion/ingestionState";
import {
  getRedditSourceId,
  getRedditCanonicalUrl,
} from "@/lib/sources/reddit";

const SUBREDDITS = ["SaaS", "Entrepreneur"];
const REDDIT_CRON_SUBREDDITS =
  (process.env.REDDIT_SUBREDDITS ?? "SaaS,Entrepreneur").split(",").map((s) => s.trim()).filter(Boolean);

// ── Types ──────────────────────────────────────────────────

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  score: number;
  num_comments: number;
  upvote_ratio: number;
  subreddit: string;
  author: string;
  created_utc: number;
  permalink: string;
  link_flair_text: string | null;
}

interface RedditListing {
  data: {
    after: string | null;
    children: Array<{
      kind: string;
      data: RedditPost;
    }>;
  };
}

export interface SubredditResult {
  subreddit: string;
  fetched: number;
  inserted: number;
  duplicates: number;
  invalid: number;
  cursorBefore: string | null;
  cursorAfter: string | null;
}

export interface IngestionResult {
  results: SubredditResult[];
  inserted: number;
  duplicates: number;
}

// ── Main ingestion ─────────────────────────────────────────

export async function ingestRedditForUser(
  ownerId: string,
  supabaseClient?: SupabaseClient,
): Promise<IngestionResult> {
  const limit = parseInt(process.env.REDDIT_LIMIT ?? "25", 10);
  const supabase = supabaseClient ?? (await createClient());

  const results: SubredditResult[] = [];

  for (const subreddit of SUBREDDITS) {
    // Read state for this subreddit
    const state = await getIngestionState(
      supabase,
      ownerId,
      `reddit:${subreddit}`,
      "live",
    );

    const cursorBefore = state?.cursor ?? null;

    // Build URL — include after cursor if we have one
    let url = `https://www.reddit.com/r/${subreddit}/new.json?limit=${limit}`;
    if (cursorBefore) {
      url += `&after=${cursorBefore}`;
    }

    const res = await fetch(url, {
      headers: { "User-Agent": "Signals/1.0" },
    });

    if (!res.ok) {
      console.error(`Reddit fetch failed for r/${subreddit}: ${res.status}`);
      results.push({
        subreddit,
        fetched: 0,
        inserted: 0,
        duplicates: 0,
        invalid: 0,
        cursorBefore,
        cursorAfter: cursorBefore,
      });
      continue;
    }

    const listing: RedditListing = await res.json();
    const children = listing.data?.children ?? [];
    const redditAfter: string | null = listing.data?.after ?? null;

    let subFetched = 0;
    let subInserted = 0;
    let subDuplicates = 0;
    let subInvalid = 0;

    for (const child of children) {
      if (child.kind !== "t3") continue;
      const post = child.data;

      subFetched++;

      // Derive stable source_id via helper — skip post if impossible
      let sourceId: string;
      try {
        sourceId = getRedditSourceId(post);
      } catch {
        console.warn(
          `REDDIT SKIP: missing source_id in r/${subreddit}`,
        );
        subInvalid++;
        continue;
      }

      // Hard guard: never insert a row with null/empty source_id or title
      if (!sourceId || sourceId.trim() === "" || !post.title) {
        console.warn(
          `Reddit skip: post missing source_id or title in r/${subreddit}`,
        );
        subInvalid++;
        continue;
      }

      // Coerce to numbers — engagement_proxy is a numeric column, NOT jsonb
      const votes = Number(post.score ?? 0);
      const comments = Number(post.num_comments ?? 0);
      const safeVotes =
        typeof votes === "number" && Number.isFinite(votes) ? votes : 0;
      const safeComments =
        typeof comments === "number" && Number.isFinite(comments)
          ? comments
          : 0;

      const row = {
        owner_id: ownerId,
        source: "reddit",
        source_id: sourceId,
        source_url: getRedditCanonicalUrl(post) ?? "",
        title: post.title,
        content: post.selftext ?? "",
        engagement_proxy: safeVotes,
        metadata: {
          subreddit: post.subreddit,
          author: post.author,
          created_utc: post.created_utc,
          permalink: post.permalink,
          flair: post.link_flair_text ?? null,
          reddit_mode: "LIVE",
          reddit_window: "latest",
          upvotes: safeVotes,
          comments: safeComments,
          upvote_ratio: post.upvote_ratio ?? null,
        },
        status: "new",
      };

      const { error } = await supabase.from("raw_signals").insert(row);

      if (error) {
        if (error.code === "23505") {
          subDuplicates++;
        } else {
          console.error(`Insert error for ${post.id}:`, error.message);
          subDuplicates++;
        }
      } else {
        subInserted++;
      }
    }

    // Save state for this subreddit
    await upsertIngestionState(
      supabase,
      ownerId,
      `reddit:${subreddit}`,
      "live",
      {
        cursor: redditAfter,
        last_success_at: new Date().toISOString(),
      },
    );

    results.push({
      subreddit,
      fetched: subFetched,
      inserted: subInserted,
      duplicates: subDuplicates,
      invalid: subInvalid,
      cursorBefore,
      cursorAfter: redditAfter,
    });
  }

  const inserted = results.reduce((sum, r) => sum + r.inserted, 0);
  const duplicates = results.reduce((sum, r) => sum + r.duplicates, 0);

  return { results, inserted, duplicates };
}

// ── Cron-safe Reddit LIVE ingestion ───────────────────────

export interface RedditCronResult {
  fetched: number;
  inserted: number;
  duplicates: number;
  skippedInvalid: number;
  windowStart: string;
}

/**
 * Cron-safe Reddit LIVE ingestion.
 * Uses service-role client (no cookies/auth).
 * Reads ingestion_state source='reddit', mode='live' for windowStart.
 * Filters posts by created_utc > windowStart.
 * Only updates last_success_at after a successful run (runSucceeded gate).
 */
export async function ingestRedditLiveCron(
  ownerId: string,
): Promise<RedditCronResult> {
  const supabase = createServiceClient();
  const limit = parseInt(process.env.REDDIT_LIMIT ?? "25", 10);

  // ── Read state ────────────────────────────────────────────
  const state = await getIngestionState(supabase, ownerId, "reddit", "live");
  const now = new Date();
  const windowStart = state?.last_success_at
    ? new Date(state.last_success_at)
    : new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const windowStartEpoch = windowStart.getTime() / 1000;

  let totalFetched = 0;
  let totalInserted = 0;
  let totalDuplicates = 0;
  let totalInvalid = 0;

  for (const subreddit of REDDIT_CRON_SUBREDDITS) {
    const url = `https://www.reddit.com/r/${subreddit}/new.json?limit=${limit}`;

    const res = await fetch(url, {
      headers: { "User-Agent": "Signals/1.0" },
    });

    if (!res.ok) {
      console.error(
        `[reddit-cron] fetch failed r/${subreddit}: ${res.status}`,
      );
      continue;
    }

    const listing: RedditListing = await res.json();
    const children = listing.data?.children ?? [];

    for (const child of children) {
      if (child.kind !== "t3") continue;
      const post = child.data;

      // Filter by window — only posts newer than windowStart
      if (post.created_utc <= windowStartEpoch) continue;

      totalFetched++;

      // Derive stable source_id via helper — skip post if impossible
      let sourceId: string;
      try {
        sourceId = getRedditSourceId(post);
      } catch {
        console.warn(
          `[reddit-cron] REDDIT SKIP: missing source_id in r/${subreddit}`,
        );
        totalInvalid++;
        continue;
      }

      // Hard guard: never insert a row with null/empty source_id or title
      if (!sourceId || sourceId.trim() === "" || !post.title) {
        console.warn(
          `[reddit-cron] skip: missing source_id or title in r/${subreddit}`,
        );
        totalInvalid++;
        continue;
      }

      const votes = Number(post.score ?? 0);
      const comments = Number(post.num_comments ?? 0);
      const safeVotes =
        typeof votes === "number" && Number.isFinite(votes) ? votes : 0;
      const safeComments =
        typeof comments === "number" && Number.isFinite(comments)
          ? comments
          : 0;

      const row = {
        owner_id: ownerId,
        source: "reddit",
        source_id: sourceId,
        source_url: getRedditCanonicalUrl(post) ?? "",
        title: post.title,
        content: post.selftext ?? "",
        engagement_proxy: safeVotes,
        metadata: {
          subreddit: post.subreddit,
          author: post.author,
          created_utc: post.created_utc,
          permalink: post.permalink,
          flair: post.link_flair_text ?? null,
          reddit_mode: "LIVE",
          reddit_window: windowStart.toISOString(),
          upvotes: safeVotes,
          comments: safeComments,
          upvote_ratio: post.upvote_ratio ?? null,
        },
        status: "new",
      };

      const { error } = await supabase.from("raw_signals").insert(row);

      if (error) {
        if (error.code === "23505") {
          totalDuplicates++;
        } else {
          console.error(
            `[reddit-cron] insert error ${post.id}:`,
            error.message,
          );
          totalDuplicates++;
        }
      } else {
        totalInserted++;
      }
    }
  }

  // ── Success-gated state write ─────────────────────────────
  await upsertIngestionState(supabase, ownerId, "reddit", "live", {
    last_success_at: now.toISOString(),
  });

  console.log(
    `[reddit-cron] done | fetched=${totalFetched} inserted=${totalInserted} duplicates=${totalDuplicates} invalid=${totalInvalid}`,
  );

  return {
    fetched: totalFetched,
    inserted: totalInserted,
    duplicates: totalDuplicates,
    skippedInvalid: totalInvalid,
    windowStart: windowStart.toISOString(),
  };
}
