function getFeaturedImageVariants(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeJsonValue);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nestedValue]) => [key, normalizeJsonValue(nestedValue)])
  );
}

export function featuredImageVariantsEqual(left: unknown, right: unknown) {
  return (
    JSON.stringify(normalizeJsonValue(getFeaturedImageVariants(left))) ===
    JSON.stringify(normalizeJsonValue(getFeaturedImageVariants(right)))
  );
}
