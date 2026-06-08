export function normalizeAnalyticsId(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed || null;
}
