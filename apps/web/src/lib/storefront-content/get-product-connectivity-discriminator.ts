import { normalizeContentCurrencyTokens } from './normalize-content-currency-tokens';
import { normalizeVariantDiscriminatorTokens } from './normalize-variant-discriminator-tokens';

const CONNECTIVITY_DISCRIMINATOR_TOKENS = new Set([
  '4g',
  '5g',
  'cellular',
  'lte',
  'wifi',
]);

/** Returns the connectivity tokens that distinguish a PDP from sibling variants. */
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
  return tokens.filter((token) => CONNECTIVITY_DISCRIMINATOR_TOKENS.has(token));
}
