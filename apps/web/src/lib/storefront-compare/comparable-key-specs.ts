import type { ComparableProductKeySpecs } from '@/lib/storefront-specs/spec-taxonomy';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

/**
 * Normalizes the `product_key_specs` relation payload (object, single-element
 * array, or absent) into one comparable spec record, shared by the compare
 * loader and the compare category inventory projection.
 */
export function extractComparableKeySpecs(
  value: unknown
): ComparableProductKeySpecs | null {
  if (Array.isArray(value)) {
    const firstRecord = value.find(isRecord);
    return firstRecord ?? null;
  }

  return isRecord(value) ? value : null;
}
