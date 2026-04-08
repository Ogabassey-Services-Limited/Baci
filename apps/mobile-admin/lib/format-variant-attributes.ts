function collectVariantAttributeValues(value: unknown): string[] {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? [String(value)] : [];
  }

  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectVariantAttributeValues(item));
  }

  if (typeof value !== 'object') {
    return [];
  }

  const record = value as Record<string, unknown>;

  for (const key of ['options', 'value', 'name', 'label'] as const) {
    const prioritizedValues = collectVariantAttributeValues(record[key]);
    if (prioritizedValues.length > 0) {
      return prioritizedValues;
    }
  }

  return Object.entries(record)
    .filter(([key]) => !['id', 'key', 'param', 'type'].includes(key))
    .flatMap(([, nestedValue]) => collectVariantAttributeValues(nestedValue));
}

export function formatVariantAttributesSummary(
  variantAttributes: unknown
): string | null {
  const values = collectVariantAttributeValues(variantAttributes).filter(Boolean);
  const uniqueValues = values.filter(
    (value, index) => values.indexOf(value) === index
  );

  return uniqueValues.length > 0 ? uniqueValues.join(' / ') : null;
}
