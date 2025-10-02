/**
 * Text utilities for deduplication and normalization
 */

/**
 * Normalizes a title for deduplication purposes
 * - Converts to lowercase
 * - Strips punctuation and special characters
 * - Collapses multiple spaces into single spaces
 * - Trims whitespace
 */
export function normalizeTitleForDedup(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')    // Collapse multiple spaces
    .trim();
}

/**
 * Removes duplicates from an array based on a key function
 * @param arr - Array to deduplicate
 * @param key - Function that returns the key to deduplicate by
 * @returns Array with duplicates removed (first occurrence kept)
 */
export function uniqueBy<T>(arr: T[], key: (x: T) => string): T[] {
  const seen = new Set<string>();
  return arr.filter(item => {
    const keyValue = key(item);
    if (seen.has(keyValue)) {
      return false;
    }
    seen.add(keyValue);
    return true;
  });
}

/**
 * Truncates text to a maximum length with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}
