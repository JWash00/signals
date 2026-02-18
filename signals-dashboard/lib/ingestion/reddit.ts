import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

const SUBREDDITS = ["SaaS", "Entrepreneur"];

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
    children: Array<{
      kind: string;
      data: RedditPost;
    }>;
  };
}

export interface SubredditResult {
  subreddit: string;
  inserted: number;
  skipped: number;
}

export interface IngestionResult {
  results: SubredditResult[];
  inserted: number;
  skipped: number;
}

export async function ingestRedditForUser(
  ownerId: string,
  supabaseClient?: SupabaseClient,
): Promise<IngestionResult> {
  const limit = parseInt(process.env.REDDIT_LIMIT ?? "25", 10);
  const supabase = supabaseClient ?? (await createClient());

  const results: SubredditResult[] = [];

  for (const subreddit of SUBREDDITS) {
    let subInserted = 0;
    let subSkipped = 0;

    const url = `https://www.reddit.com/r/${subreddit}/new.json?limit=${limit}`;

    const res = await fetch(url, {
      headers: { "User-Agent": "Signals/1.0" },
    });

    if (!res.ok) {
      console.error(`Reddit fetch failed for r/${subreddit}: ${res.status}`);
      results.push({ subreddit, inserted: 0, skipped: 0 });
      continue;
    }

    const listing: RedditListing = await res.json();

    for (const child of listing.data.children) {
      if (child.kind !== "t3") continue;

      const post = child.data;

      // Hard guard: never insert a row with null source_id
      if (!post.id) {
        console.warn("Reddit skip: post missing id in r/" + subreddit);
        subSkipped++;
        continue;
      }

      const row = {
        owner_id: ownerId,
        source: "reddit",
        source_id: post.id,
        source_url: `https://www.reddit.com${post.permalink}`,
        title: post.title,
        content: post.selftext ?? "",
        engagement_proxy: {
          upvotes: post.score ?? null,
          comments: post.num_comments ?? null,
          upvote_ratio: post.upvote_ratio ?? null,
        },
        metadata: {
          subreddit: post.subreddit,
          author: post.author,
          created_utc: post.created_utc,
          permalink: post.permalink,
          flair: post.link_flair_text ?? null,
          reddit_mode: "LIVE" as const,
          reddit_window: "latest",
        },
        status: "new",
      };

      const { error } = await supabase.from("raw_signals").insert(row);

      if (error) {
        if (error.code === "23505") {
          // Unique constraint violation — duplicate
          subSkipped++;
        } else {
          console.error(`Insert error for ${post.id}:`, error.message);
          subSkipped++;
        }
      } else {
        subInserted++;
      }
    }

    results.push({ subreddit, inserted: subInserted, skipped: subSkipped });
  }

  const inserted = results.reduce((sum, r) => sum + r.inserted, 0);
  const skipped = results.reduce((sum, r) => sum + r.skipped, 0);

  return { results, inserted, skipped };
}
