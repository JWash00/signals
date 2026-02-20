/**
 * Deterministic problem-signature generator (no AI).
 *
 * Used by auto-mode to group approved signals into Pain Groups
 * based on keyword overlap rather than embeddings.
 */

const FILLER_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "shall",
  "should", "may", "might", "must", "can", "could", "am", "to", "of",
  "in", "for", "on", "with", "at", "by", "from", "as", "into", "about",
  "like", "through", "after", "over", "between", "out", "against",
  "during", "without", "before", "under", "around", "among", "and",
  "but", "or", "nor", "not", "so", "yet", "both", "either", "neither",
  "each", "every", "all", "any", "few", "more", "most", "some", "such",
  "no", "only", "own", "same", "than", "too", "very", "just", "because",
  "if", "when", "while", "how", "what", "which", "who", "whom", "this",
  "that", "these", "those", "i", "me", "my", "we", "our", "you", "your",
  "he", "him", "his", "she", "her", "it", "its", "they", "them", "their",
  "get", "got", "going", "go", "make", "made", "thing", "things",
  "really", "much", "many", "also", "even", "still", "already", "here",
  "there", "where", "then", "now", "up", "down", "well", "back",
  "way", "one", "two", "dont", "doesnt", "cant", "wont", "im",
]);

const SIGNATURE_KEYWORD_COUNT = 8;

/**
 * Lowercase, strip punctuation, collapse whitespace.
 */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Deterministic "problem signature" from title + optional body.
 *
 * 1. Normalize text
 * 2. Remove filler words
 * 3. Take top N keywords (by first-occurrence order, title words first)
 * 4. Sort alphabetically and join with "-"
 *
 * Returns a stable, reproducible string like "api-database-errors-latency-performance-scaling-slow-timeout".
 */
export function problemSignature(
  title: string,
  body?: string | null,
): string {
  const combined = body ? `${title} ${body}` : title;
  const normalized = normalizeText(combined);
  const words = normalized.split(" ");

  const seen = new Set<string>();
  const keywords: string[] = [];

  for (const word of words) {
    if (word.length < 2) continue;
    if (FILLER_WORDS.has(word)) continue;
    if (seen.has(word)) continue;
    seen.add(word);
    keywords.push(word);
    if (keywords.length >= SIGNATURE_KEYWORD_COUNT) break;
  }

  // Sort alphabetically for stable comparison regardless of word order
  return keywords.sort().join("-");
}
