export type CanonicalProductCondition = 'new' | 'open_box' | 'used';
export type GoogleListingCondition = 'new' | 'refurbished' | 'used';

const CANONICAL_PRODUCT_CONDITIONS = new Set<CanonicalProductCondition>([
  'new',
  'open_box',
  'used',
]);

const SCHEMA_ITEM_CONDITION_URIS = {
  new: 'https://schema.org/NewCondition',
  refurbished: 'https://schema.org/RefurbishedCondition',
  used: 'https://schema.org/UsedCondition',
} as const;

export function normalizeCanonicalProductCondition(
  value: string | null | undefined
): CanonicalProductCondition | '' {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (normalized === 'uk_used') {
    return 'used';
  }

  if (normalized === 'refurbished') {
    return 'open_box';
  }

  return CANONICAL_PRODUCT_CONDITIONS.has(
    normalized as CanonicalProductCondition
  )
    ? (normalized as CanonicalProductCondition)
    : '';
}

export function formatCanonicalProductConditionLabel(
  value: string | null | undefined
): string | undefined {
  switch (normalizeCanonicalProductCondition(value)) {
    case 'new':
      return 'New';
    case 'used':
      return 'Used';
    case 'open_box':
      return 'Open Box';
    default:
      return undefined;
  }
}

export function toGoogleListingCondition(
  value: string | null | undefined
): GoogleListingCondition | undefined {
  switch (normalizeCanonicalProductCondition(value)) {
    case 'new':
      return 'new';
    case 'used':
      return 'used';
    case 'open_box':
      return 'refurbished';
    default:
      return undefined;
  }
}

export function toSchemaItemConditionUri(value: string | null | undefined) {
  const googleListingCondition = toGoogleListingCondition(value);

  return googleListingCondition
    ? SCHEMA_ITEM_CONDITION_URIS[googleListingCondition]
    : undefined;
}
