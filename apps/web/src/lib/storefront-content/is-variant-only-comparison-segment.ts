import { isProductVariantColorToken } from './is-product-variant-color-token';
import { isProductVariantRegionToken } from './is-product-variant-region-token';
import { normalizeVariantDiscriminatorTokens } from './normalize-variant-discriminator-tokens';

const VARIANT_TOKEN_PATTERN =
  /^(?:\d+(?:g|gb|tb|mb|mm|inch)|\d+hz|4g|5g|active|bluetooth|cellular|classic|digital|disc|dual|edge|esim|fe|flip|fold|gps|lite|lte|max|mini|nano|neo|physical|plus|power|prime|pro|s|se|sim|single|ultra|wifi|x|xl)$/u;
const CONTEXT_TOKENS = new Set([
  'buyer',
  'compare',
  'comparison',
  'guide',
  'model',
  'review',
  'variant',
]);

/** Identifies a compare segment that contains variant metadata but no product phrase. */
export function isVariantOnlyComparisonSegment(tokens: string[]) {
  const normalized = normalizeVariantDiscriminatorTokens(tokens);
  const isVariantToken = (token: string) =>
    VARIANT_TOKEN_PATTERN.test(token) ||
    isProductVariantColorToken(token) ||
    (token !== 'in' && isProductVariantRegionToken(token));
  return (
    normalized.some(isVariantToken) &&
    normalized.every(
      (token) => isVariantToken(token) || CONTEXT_TOKENS.has(token)
    )
  );
}
