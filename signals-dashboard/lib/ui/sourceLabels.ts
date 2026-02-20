/**
 * Central display-name map for data sources.
 * DISPLAY ONLY — never change database keys, cron routes, or vercel.json.
 */
export const SOURCE_LABELS: Record<string, string> = {
  product_hunt: "Product Hunt",
  reddit: "Reddit",
  hacker_news: "Y Combinator (Hacker News)",
  indie_hackers_stories: "Indie Hackers (Stories)",
  indie_hackers_posts: "Indie Hackers (Posts)",
  indie_hackers_update: "Indie Hackers (Updates)",
};

export function labelForSource(source: string | null | undefined): string {
  if (!source) return "Unknown";
  return SOURCE_LABELS[source] ?? source;
}
