import { normalizeVariantDiscriminatorTokens } from './normalize-variant-discriminator-tokens';

const VARIANT_TOKEN_PATTERN =
  /^(?:\d+(?:g|gb|tb|mb|mm|inch)|4g|5g|active|bluetooth|cellular|classic|dual|edge|esim|fe|flip|fold|gps|lite|lte|max|mini|nano|neo|physical|plus|power|prime|pro|s|se|sim|single|ultra|wifi|x|xl)$/u;
const COLOR_VARIANT_TOKENS = new Set([
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
    VARIANT_TOKEN_PATTERN.test(token) || COLOR_VARIANT_TOKENS.has(token);
  return (
    normalized.some(isVariantToken) &&
    normalized.every(
      (token) => isVariantToken(token) || CONTEXT_TOKENS.has(token)
    )
  );
}
