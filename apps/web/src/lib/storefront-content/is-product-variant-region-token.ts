const PRODUCT_VARIANT_REGION_TOKENS = new Set([
  'ca',
  'cn',
  'eu',
  'gb',
  'global',
  'in',
  'international',
  'jp',
  'ng',
  'nigeria',
  'uae',
  'uk',
  'us',
]);

/** Recognizes stable single-token catalog region variants. */
export function isProductVariantRegionToken(token: string) {
  return PRODUCT_VARIANT_REGION_TOKENS.has(token);
}
