import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getIngestionState,
  upsertIngestionState,
} from "@/lib/ingestionState";

const SUBREDDITS = ["SaaS", "Entrepreneur"];

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
    const state = await getIngestionState({
      source: `reddit:${subreddit}`,
      mode: "live",
      owner_id: ownerId,
    });

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

      // Hard guard: never insert a row with null source_id or missing title
      if (!post.id || !post.title) {
        console.warn(
          `Reddit skip: post missing id or title in r/${subreddit}`,
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
        source_id: post.id,
        source_url: `https://www.reddit.com${post.permalink}`,
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
    await upsertIngestionState({
      source: `reddit:${subreddit}`,
      mode: "live",
      owner_id: ownerId,
      cursor: redditAfter,
      meta: {
        subreddit,
        fetched: subFetched,
        inserted: subInserted,
        duplicates: subDuplicates,
        invalid: subInvalid,
        after: redditAfter,
      },
    });

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
