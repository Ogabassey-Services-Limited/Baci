const VARIANT_COLOR_KEYS = ['color', 'colour'] as const;
const VARIANT_COLOR_KEY_SET = new Set<string>(VARIANT_COLOR_KEYS);

export function readVariantColor(
  attributes?: Record<string, unknown> | null
): string | null {
  if (!attributes) {
    return null;
  }

  const valuesByKey = new Map<(typeof VARIANT_COLOR_KEYS)[number], string>();

  for (const [key, value] of Object.entries(attributes)) {
    const normalizedKey = key.trim().toLowerCase();
    if (
      !VARIANT_COLOR_KEY_SET.has(normalizedKey) ||
      typeof value !== 'string'
    ) {
      continue;
    }

    const trimmed = value.trim();
    if (trimmed) {
      valuesByKey.set(
        normalizedKey as (typeof VARIANT_COLOR_KEYS)[number],
        trimmed
      );
    }
  }

  return valuesByKey.get('color') ?? valuesByKey.get('colour') ?? null;
}
