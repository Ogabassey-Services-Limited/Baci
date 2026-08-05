import type { SupportedClusterCategory } from './content-cluster-types';
import { isProductVariantColorToken } from './is-product-variant-color-token';
import { normalizeContentCurrencyTokens } from './normalize-content-currency-tokens';
import { normalizeVariantDiscriminatorTokens } from './normalize-variant-discriminator-tokens';

const CONNECTIVITY_DISCRIMINATOR_TOKENS = new Set([
  '4g',
  '5g',
  'bluetooth',
  'cellular',
  'dual',
  'esim',
  'gps',
  'lte',
  'nano',
  'physical',
  'sim',
  'single',
  'wifi',
]);
const SIM_MODE_DISCRIMINATOR_TOKENS = new Set([
  'dual',
  'esim',
  'nano',
  'physical',
  'sim',
  'single',
]);
const DIMENSION_DISCRIMINATOR_PATTERN = /^\d+(?:mm|inch)$/u;
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

function tokenizeVariantSource(source: string | undefined) {
  return normalizeVariantDiscriminatorTokens(
    normalizeContentCurrencyTokens(source ?? '')
      .toLowerCase()
      .split(/[^a-z0-9]+/u)
      .filter(Boolean)
  );
}

function getDiscriminatorGroup(token: string) {
  if (SIM_MODE_DISCRIMINATOR_TOKENS.has(token)) {
    return 'sim';
  }
  if (CONNECTIVITY_DISCRIMINATOR_TOKENS.has(token)) {
    return 'connectivity';
  }
  if (DIMENSION_DISCRIMINATOR_PATTERN.test(token)) {
    return 'dimension';
  }
  if (getStorageCapacityGb(token) !== null) {
    return 'storage';
  }
  if (isProductVariantColorToken(token)) {
    return 'color';
  }
  return null;
}

/** Returns PDP variant discriminators for group-aware guide matching. */
export function getProductConnectivityDiscriminators(
  productNames: string[] | undefined,
  productSlugs: string[] | undefined,
  categorySlug?: SupportedClusterCategory
) {
  const tokens = productNames?.length
    ? productNames.flatMap((name, index) => {
        const nameTokens = tokenizeVariantSource(name);
        const namedGroups = new Set(nameTokens.map(getDiscriminatorGroup));
        const supplementalSlugTokens = tokenizeVariantSource(
          productSlugs?.[index]
        ).filter((token) => {
          const group = getDiscriminatorGroup(token);
          return group && !namedGroups.has(group);
        });
        return [...nameTokens, ...supplementalSlugTokens];
      })
    : (productSlugs ?? []).flatMap(tokenizeVariantSource);
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
      DIMENSION_DISCRIMINATOR_PATTERN.test(token) ||
      isProductVariantColorToken(token) ||
      token === strongestStorageToken
  );
}
