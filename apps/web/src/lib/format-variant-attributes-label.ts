type VariantAttributesRecord = Record<string, unknown>;

function isVariantAttributesRecord(
  value: unknown
): value is VariantAttributesRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function formatVariantAttributesLabel(
  value: unknown
): string | undefined {
  if (!isVariantAttributesRecord(value)) {
    return undefined;
  }

  const parts = Object.entries(value)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .flatMap(([, rawValue]) =>
      typeof rawValue === 'string' ? [rawValue.trim()] : []
    )
    .filter((part) => part.length > 0);

  return parts.length > 0 ? parts.join(' / ') : undefined;
}
