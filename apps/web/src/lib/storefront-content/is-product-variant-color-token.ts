const PRODUCT_VARIANT_COLOR_TOKENS = new Set([
  'beige',
  'black',
  'blue',
  'bronze',
  'brown',
  'cream',
  'gold',
  'gray',
  'green',
  'grey',
  'orange',
  'pink',
  'purple',
  'red',
  'silver',
  'tan',
  'teal',
  'white',
  'yellow',
]);

/** Recognizes stable single-token catalog color variants. */
export function isProductVariantColorToken(token: string) {
  return PRODUCT_VARIANT_COLOR_TOKENS.has(token);
}
