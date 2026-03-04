/**
 * Supabase can return a joined record as either an object or a single-element
 * array depending on the join type. This normalizes both to a single record.
 */
export function getJoinedRecord<T>(
  value: T | T[] | null | undefined
): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
