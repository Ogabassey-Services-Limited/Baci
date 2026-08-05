import { normalizeVariantDiscriminatorTokens } from './normalize-variant-discriminator-tokens';

const VARIANT_TOKEN_PATTERN =
  /^(?:\d+(?:g|gb|tb|mb|mm|inch)|4g|5g|active|bluetooth|cellular|classic|dual|edge|esim|fe|flip|fold|gps|lite|lte|max|mini|nano|neo|physical|plus|power|prime|pro|se|sim|single|ultra|wifi|xl)$/u;
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
  return (
    normalized.some((token) => VARIANT_TOKEN_PATTERN.test(token)) &&
    normalized.every(
      (token) => VARIANT_TOKEN_PATTERN.test(token) || CONTEXT_TOKENS.has(token)
    )
  );
}
