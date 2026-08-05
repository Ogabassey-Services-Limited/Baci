import type { SupportedClusterCategory } from './content-cluster-types';
import { isProductVariantColorToken } from './is-product-variant-color-token';
import { isProductVariantRegionToken } from './is-product-variant-region-token';
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
const DIMENSION_DISCRIMINATOR_PATTERN = /^\d+(?:\.\d+)?(?:mm|inch)$/u;
const BATTERY_CAPACITY_DISCRIMINATOR_PATTERN = /^\d+mah$/u;
const REFRESH_RATE_DISCRIMINATOR_PATTERN = /^\d+hz$/u;
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
    normalizeContentCurrencyTokens(
      (source ?? '').replace(/(\d{1,2}(?:\.\d+)?)\s*["″”]/gu, '$1 inch')
    )
      .toLowerCase()
      .split(/[^a-z0-9]+/u)
      .filter(Boolean)
  );
}

function getDiscriminatorGroup(token: string, isTerminal = false) {
  if (SIM_MODE_DISCRIMINATOR_TOKENS.has(token)) {
    return 'sim';
  }
  if (CONNECTIVITY_DISCRIMINATOR_TOKENS.has(token)) {
    return 'connectivity';
  }
  if (DIMENSION_DISCRIMINATOR_PATTERN.test(token)) {
    return 'dimension';
  }
  if (BATTERY_CAPACITY_DISCRIMINATOR_PATTERN.test(token)) {
    return 'battery-capacity';
  }
  if (REFRESH_RATE_DISCRIMINATOR_PATTERN.test(token)) {
    return 'refresh-rate';
  }
  if (getStorageCapacityGb(token) !== null) {
    return 'storage';
  }
  if (isProductVariantColorToken(token)) {
    return 'color';
  }
  if (isTerminal && isProductVariantRegionToken(token)) {
    return 'region';
  }
  return null;
}

function isLikelyRamToken(
  token: string,
  categorySlug: SupportedClusterCategory | undefined,
  nextToken = ''
) {
  const capacity = getStorageCapacityGb(token);
  return (
    capacity !== null &&
    capacity <= 32 &&
    (nextToken === 'ram' || RAM_DOMINANT_CATEGORIES.has(categorySlug ?? ''))
  );
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
        const namedGroups = new Set(
          nameTokens
            .filter(
              (token, tokenIndex) =>
                !isLikelyRamToken(
                  token,
                  categorySlug,
                  nameTokens[tokenIndex + 1]
                )
            )
            .map((token, tokenIndex) =>
              getDiscriminatorGroup(token, tokenIndex === nameTokens.length - 1)
            )
        );
        const supplementalSlugTokens = tokenizeVariantSource(
          productSlugs?.[index]
        ).filter((token, tokenIndex, slugTokens) => {
          const group = getDiscriminatorGroup(
            token,
            tokenIndex === slugTokens.length - 1
          );
          return group && !namedGroups.has(group);
        });
        return [...nameTokens, ...supplementalSlugTokens];
      })
    : (productSlugs ?? []).flatMap(tokenizeVariantSource);
  const strongestStorageToken = tokens.reduce<string | null>(
    (strongest, token, tokenIndex) => {
      const tokenCapacity = getStorageCapacityGb(token);
      const strongestCapacity = getStorageCapacityGb(strongest ?? '') ?? 0;
      const isLikelyRam = isLikelyRamToken(
        token,
        categorySlug,
        tokens[tokenIndex + 1]
      );
      return tokenCapacity && !isLikelyRam && tokenCapacity > strongestCapacity
        ? token
        : strongest;
    },
    null
  );
  return tokens.filter(
    (token, tokenIndex) =>
      CONNECTIVITY_DISCRIMINATOR_TOKENS.has(token) ||
      DIMENSION_DISCRIMINATOR_PATTERN.test(token) ||
      BATTERY_CAPACITY_DISCRIMINATOR_PATTERN.test(token) ||
      (categorySlug === 'monitors' &&
        REFRESH_RATE_DISCRIMINATOR_PATTERN.test(token)) ||
      isProductVariantColorToken(token) ||
      (tokenIndex === tokens.length - 1 &&
        isProductVariantRegionToken(token)) ||
      token === strongestStorageToken
  );
}
