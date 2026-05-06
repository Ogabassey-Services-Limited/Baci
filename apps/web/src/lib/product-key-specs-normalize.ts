type ProductKeySpecValue = string | number | boolean | undefined;

/**
 * Flattens Supabase/PostgREST embedded product_key_specs relation payloads into
 * the single object shape expected by storefront SEO and semantic consumers.
 */
export function normalizeProductKeySpecs(
  value: unknown
): Record<string, ProductKeySpecValue> | null {
  if (Array.isArray(value)) {
    return normalizeProductKeySpecs(value[0]);
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const entries = Object.entries(value).filter(([, entryValue]) => {
    return (
      typeof entryValue === 'string' ||
      typeof entryValue === 'number' ||
      typeof entryValue === 'boolean' ||
      typeof entryValue === 'undefined'
    );
  });

  return entries.length > 0 ? Object.fromEntries(entries) : null;
}
