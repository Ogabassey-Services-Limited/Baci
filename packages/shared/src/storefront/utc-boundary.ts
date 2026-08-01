export const UTC_DAY_MILLISECONDS = 86_400_000;
export const STRICT_UTC_BOUNDARY_PATTERN = /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/;

/** Parses a canonical UTC-midnight boundary without allowing Date normalization. */
export function parseStrictUtcBoundary(value: string): Date | null {
  if (!STRICT_UTC_BOUNDARY_PATTERN.test(value)) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString() === value
    ? parsed
    : null;
}
