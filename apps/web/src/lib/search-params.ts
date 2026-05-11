/**
 * Extracts the first string from a Next.js search-param value.
 *
 * Route search params can arrive as a scalar string, an array, or unexpected
 * values in tests and edge cases. Non-string values return undefined.
 */
export function getFirstSearchParam(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const firstValue = value[0];
    return typeof firstValue === 'string' ? firstValue : undefined;
  }

  return typeof value === 'string' ? value : undefined;
}
