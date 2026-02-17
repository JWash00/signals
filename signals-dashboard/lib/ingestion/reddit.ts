import { createClient } from "@/lib/supabase/server";

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

export async function ingestRedditForUser(
  ownerId: string,
): Promise<{ inserted: number; skipped: number }> {
  const subreddits = (process.env.REDDIT_SUBREDDITS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (subreddits.length === 0) {
    throw new Error("REDDIT_SUBREDDITS env var is not set or empty");
  }

  const limit = parseInt(process.env.REDDIT_LIMIT ?? "25", 10);
  const supabase = await createClient();

  let inserted = 0;
  let skipped = 0;

  for (const subreddit of subreddits) {
    const url = `https://www.reddit.com/r/${subreddit}/new.json?limit=${limit}`;

    const res = await fetch(url, {
      headers: { "User-Agent": "Signals/1.0" },
    });

    if (!res.ok) {
      console.error(`Reddit fetch failed for r/${subreddit}: ${res.status}`);
      continue;
    }

    const listing: RedditListing = await res.json();

    for (const child of listing.data.children) {
      if (child.kind !== "t3") continue;

      const post = child.data;

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
        },
        status: "new",
      };

      const { error } = await supabase.from("raw_signals").insert(row);

      if (error) {
        if (error.code === "23505") {
          // Unique constraint violation — duplicate
          skipped++;
        } else {
          console.error(`Insert error for ${post.id}:`, error.message);
          skipped++;
        }
      } else {
        inserted++;
      }
    }
  }

  return { inserted, skipped };
}
