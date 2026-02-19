import { createServiceClient } from "@/lib/supabase/service";
import {
  getIngestionState,
  upsertIngestionState,
} from "@/lib/ingestion/ingestionState";

// ── Types ──────────────────────────────────────────────────

interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string | null;
  guid: string;
}

export interface IHCronResult {
  fetched: number;
  inserted: number;
  duplicates: number;
  skippedOld: number;
  skippedInvalid: number;
  windowStart: string;
  feedUrl: string;
}

// ── Minimal RSS XML parser ─────────────────────────────────

/**
 * Extracts <item> elements from RSS XML using regex.
 * No external dependencies — good enough for simple RSS feeds.
 */
function parseRSSItems(xml: string): RSSItem[] {
  const items: RSSItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];

    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    const description = extractTag(block, "description");
    const pubDate = extractTag(block, "pubDate");
    const guid = extractTag(block, "guid") || link || "";

    if (!title || !guid) continue;

    items.push({
      title: decodeHTMLEntities(title),
      link: link || "",
      description: decodeHTMLEntities(description || ""),
      pubDate: pubDate || null,
      guid,
    });
  }

  return items;
}

function extractTag(xml: string, tag: string): string | null {
  // Handle CDATA: <tag><![CDATA[content]]></tag>
  const cdataRegex = new RegExp(
    `<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`,
  );
  const cdataMatch = cdataRegex.exec(xml);
  if (cdataMatch) return cdataMatch[1].trim();

  // Handle plain text: <tag>content</tag>
  const plainRegex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const plainMatch = plainRegex.exec(xml);
  if (plainMatch) return plainMatch[1].trim();

  return null;
}

function decodeHTMLEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}

// ── Main cron function ────────────────────────────────────

/**
 * Cron-safe Indie Hackers LIVE ingestion via RSS feed.
 * Gracefully skips if INDIE_HACKERS_FEED_URL env var is not set.
 *
 * Uses service-role client (no cookies/auth).
 * Reads ingestion_state source='indie_hackers', mode='live' for windowStart.
 * Only updates last_success_at after a successful run (runSucceeded gate).
 */
export async function ingestIndieHackersLiveCron(
  ownerId: string,
): Promise<IHCronResult> {
  const feedUrl = process.env.INDIE_HACKERS_FEED_URL ?? "";

  if (!feedUrl) {
    console.log("[ih-cron] INDIE_HACKERS_FEED_URL not set — skipping");
    return {
      fetched: 0,
      inserted: 0,
      duplicates: 0,
      skippedOld: 0,
      skippedInvalid: 0,
      windowStart: new Date().toISOString(),
      feedUrl: "(not configured)",
    };
  }

  const supabase = createServiceClient();

  // ── Read state ────────────────────────────────────────────
  const state = await getIngestionState(
    supabase,
    ownerId,
    "indie_hackers",
    "live",
  );
  const now = new Date();
  const windowStart = state?.last_success_at
    ? new Date(state.last_success_at)
    : new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const windowStartMs = windowStart.getTime();

  // ── Fetch RSS feed ────────────────────────────────────────
  const res = await fetch(feedUrl, {
    headers: { "User-Agent": "Signals/1.0" },
  });

  if (!res.ok) {
    throw new Error(`Indie Hackers RSS fetch failed: ${res.status}`);
  }

  const xml = await res.text();
  const items = parseRSSItems(xml);

  let fetched = 0;
  let inserted = 0;
  let duplicates = 0;
  let skippedOld = 0;
  let skippedInvalid = 0;
  let runSucceeded = true;

  for (const item of items) {
    // Filter by time window if pubDate is available
    if (item.pubDate) {
      const itemDate = new Date(item.pubDate);
      if (!isNaN(itemDate.getTime()) && itemDate.getTime() <= windowStartMs) {
        skippedOld++;
        continue;
      }
    }

    fetched++;

    if (!item.title || !item.guid) {
      skippedInvalid++;
      continue;
    }

    // Use guid as source_id (strip URL prefixes to keep it shorter if possible)
    const sourceId = item.guid;

    const row = {
      owner_id: ownerId,
      source: "indie_hackers",
      source_id: sourceId,
      source_url: item.link || item.guid,
      title: item.title,
      content: item.description || "",
      engagement_proxy: 0, // RSS feeds don't provide vote counts
      metadata: {
        guid: item.guid,
        pub_date: item.pubDate ?? null,
        feed_url: feedUrl,
        ih_mode: "LIVE",
        ih_window: windowStart.toISOString(),
      },
      status: "new",
    };

    const { error } = await supabase.from("raw_signals").insert(row);

    if (error) {
      if (error.code === "23505") {
        duplicates++;
      } else {
        console.error(
          `[ih-cron] insert error ${sourceId}:`,
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
    await upsertIngestionState(
      supabase,
      ownerId,
      "indie_hackers",
      "live",
      { last_success_at: now.toISOString() },
    );
  }

  console.log(
    `[ih-cron] done | fetched=${fetched} inserted=${inserted} duplicates=${duplicates} skippedOld=${skippedOld} invalid=${skippedInvalid}`,
  );

  return {
    fetched,
    inserted,
    duplicates,
    skippedOld,
    skippedInvalid,
    windowStart: windowStart.toISOString(),
    feedUrl,
  };
}
