import { normalizeContentCurrencyTokens } from './normalize-content-currency-tokens';
import { normalizeVariantDiscriminatorTokens } from './normalize-variant-discriminator-tokens';

const CONNECTIVITY_DISCRIMINATOR_TOKENS = new Set([
  '4g',
  '5g',
  'cellular',
  'lte',
  'wifi',
]);
const STORAGE_DISCRIMINATOR_PATTERN = /^(?:[6-9]\d|\d{3,})(?:gb|tb)$/u;

/** Returns the strongest PDP variant discriminator without over-constraining guide titles. */
export function getProductConnectivityDiscriminators(
  productNames: string[] | undefined,
  productSlugs: string[] | undefined
) {
  const sources = productNames?.length ? productNames : productSlugs;
  const tokens = normalizeVariantDiscriminatorTokens(
    (sources ?? []).flatMap((source) =>
      normalizeContentCurrencyTokens(source)
        .toLowerCase()
        .split(/[^a-z0-9]+/u)
        .filter(Boolean)
    )
  );
  const connectivityTokens = tokens.filter((token) =>
    CONNECTIVITY_DISCRIMINATOR_TOKENS.has(token)
  );
  return connectivityTokens.length > 0
    ? connectivityTokens
    : tokens.filter((token) => STORAGE_DISCRIMINATOR_PATTERN.test(token));
}
