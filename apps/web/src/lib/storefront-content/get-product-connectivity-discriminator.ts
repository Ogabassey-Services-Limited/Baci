import type { SupportedClusterCategory } from './content-cluster-types';
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
const COMMON_STORAGE_CAPACITIES_GB = new Set([
  16, 32, 64, 128, 256, 512, 1024, 2048, 4096,
]);
const RAM_DOMINANT_CATEGORIES = new Set([
  'desktops',
  'gaming-laptops',
  'laptops',
]);

function getStorageCapacityGb(token: string) {
  const match = token.match(/^(\d+)(gb|tb)$/u);
  if (!match) {
    return null;
  }
  const capacity = Number(match[1]) * (match[2] === 'tb' ? 1024 : 1);
  return COMMON_STORAGE_CAPACITIES_GB.has(capacity) ? capacity : null;
}

/** Returns PDP variant discriminators for group-aware guide matching. */
export function getProductConnectivityDiscriminators(
  productNames: string[] | undefined,
  productSlugs: string[] | undefined,
  categorySlug?: SupportedClusterCategory
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
  const strongestStorageToken = tokens.reduce<string | null>(
    (strongest, token) => {
      const tokenCapacity = getStorageCapacityGb(token);
      const strongestCapacity = getStorageCapacityGb(strongest ?? '') ?? 0;
      const isLikelyLaptopRam =
        tokenCapacity !== null &&
        tokenCapacity <= 32 &&
        RAM_DOMINANT_CATEGORIES.has(categorySlug ?? '');
      return tokenCapacity &&
        !isLikelyLaptopRam &&
        tokenCapacity > strongestCapacity
        ? token
        : strongest;
    },
    null
  );
  return tokens.filter(
    (token) =>
      CONNECTIVITY_DISCRIMINATOR_TOKENS.has(token) ||
      token === strongestStorageToken
  );
}
