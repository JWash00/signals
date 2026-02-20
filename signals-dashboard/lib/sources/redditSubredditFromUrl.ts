/**
 * Extract the subreddit name from a Reddit URL.
 * Returns null if the URL doesn't contain /r/<name>/.
 */
export function subredditFromRedditUrl(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  const match = url.match(/\/r\/([A-Za-z0-9_]+)/);
  return match ? match[1] : null;
}
