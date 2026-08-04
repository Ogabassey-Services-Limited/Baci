import { normalizeContentCurrencyTokens } from './normalize-content-currency-tokens';
import { normalizeVariantDiscriminatorTokens } from './normalize-variant-discriminator-tokens';

const CONNECTIVITY_DISCRIMINATOR_TOKENS = new Set([
  '4g',
  '5g',
  'cellular',
  'esim',
  'lte',
  'physical',
  'sim',
  'wifi',
]);
const STORAGE_DISCRIMINATOR_PATTERN = /^(?:[6-9]\d|\d{3,})(?:gb|tb)$/u;

/** Returns PDP variant discriminators for group-aware guide matching. */
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
  return tokens.filter(
    (token) =>
      CONNECTIVITY_DISCRIMINATOR_TOKENS.has(token) ||
      STORAGE_DISCRIMINATOR_PATTERN.test(token)
  );
}
