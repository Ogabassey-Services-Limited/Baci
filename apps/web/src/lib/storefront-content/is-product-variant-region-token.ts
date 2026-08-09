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

interface RegionTokenContext {
  isTerminal?: boolean;
}

/** Recognizes stable single-token catalog region variants. */
export function isProductVariantRegionToken(
  token: string,
  context: RegionTokenContext = {}
) {
  return (
    PRODUCT_VARIANT_REGION_TOKENS.has(token) &&
    (token !== 'in' || context.isTerminal === true)
  );
}
