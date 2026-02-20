/**
 * Stable Reddit source_id and URL helpers.
 * Ensures raw_signals rows never have a null source_id for reddit.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Derives a stable, non-null source_id from a Reddit post object.
 * Tries fields in order of preference: name > id > permalink > url.
 * Throws if no usable identifier can be found.
 */
export function getRedditSourceId(post: any): string {
  if (typeof post.name === "string" && post.name.trim() !== "") {
    return post.name.trim();
  }
  if (typeof post.id === "string" && post.id.trim() !== "") {
    return `t3_${post.id.trim()}`;
  }
  if (typeof post.permalink === "string" && post.permalink.trim() !== "") {
    return post.permalink.trim();
  }
  if (typeof post.url === "string" && post.url.trim() !== "") {
    return post.url.trim();
  }
  throw new Error("REDDIT SOURCE_ID MISSING: no usable identifier on post");
}

/**
 * Derives a canonical Reddit URL from a post object.
 * Returns null if no URL can be constructed.
 */
export function getRedditCanonicalUrl(post: any): string | null {
  if (typeof post.permalink === "string" && post.permalink.trim() !== "") {
    return `https://www.reddit.com${post.permalink.trim()}`;
  }
  if (typeof post.url === "string" && post.url.trim() !== "") {
    return post.url.trim();
  }
  return null;
}

/**
 * Attempts to derive a source_id from a raw_signals row that has null source_id.
 * Used by the backfill admin route.
 * Returns null if nothing usable is found.
 */
export function deriveSourceIdFromRow(row: {
  raw?: any;
  url?: string | null;
}): string | null {
  const raw = row.raw;

  // Try raw.name (e.g. "t3_abcdef")
  if (raw && typeof raw.name === "string" && raw.name.trim() !== "") {
    return raw.name.trim();
  }

  // Try raw.id (e.g. "abcdef")
  if (raw && typeof raw.id === "string" && raw.id.trim() !== "") {
    return `t3_${raw.id.trim()}`;
  }

  // Try raw.permalink
  if (raw && typeof raw.permalink === "string" && raw.permalink.trim() !== "") {
    return raw.permalink.trim();
  }

  // Try extracting from URL: /r/SaaS/comments/<id>/...
  if (typeof row.url === "string" && row.url.trim() !== "") {
    const match = row.url.match(/\/comments\/([a-z0-9]+)\//i);
    if (match) {
      return `t3_${match[1]}`;
    }
    // Last resort: use the URL itself
    return row.url.trim();
  }

  return null;
}
