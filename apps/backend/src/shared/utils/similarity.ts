/**
 * Splits the input string into a set of unique, lowercase tokens. Non-alphanumeric
 * characters are replaced with spaces, and tokens shorter than three characters
 * are excluded.
 *
 * @param {string} input The string to be tokenized. If null or undefined, it is treated as an empty string.
 * @return {Set<string>} A set of lowercase tokens, each at least three characters long.
 */
export function tokenize(input: string): Set<string> {
  const s = String(input ?? '');
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3),
  );
}

/**
 * Computes the Jaccard similarity coefficient between two sets.
 *
 * The Jaccard similarity measures the similarity between two sets
 * by dividing the size of their intersection by the size of their union.
 *
 * TL;DR: The more words two articles have in common, the more similar they are.
 * This metric is called Jaccard similarity.
 *
 * @see https://www.ibm.com/think/topics/jaccard-similarity
 * @param {Set<string>} a - The first set of strings to compare.
 * @param {Set<string>} b - The second set of strings to compare.
 * @return {number} The Jaccard similarity coefficient, which is a value between 0 and 1.
 *                  Returns 0 if either set is empty.
 */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}
