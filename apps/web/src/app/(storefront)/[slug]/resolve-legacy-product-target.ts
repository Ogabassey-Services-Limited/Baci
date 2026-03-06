import { cache } from 'react';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
  getCachedProduct,
} from '@/lib/cached-data';
import { getProductUrl } from '@/lib/seo-utils';
import { isDomainIdentifier } from '@/lib/validation';

interface LegacyProductCategory {
  name?: string;
  slug?: string;
}

interface LegacyProductCategoryJoin {
  categories?: LegacyProductCategory | null;
}

const LEGACY_PRODUCT_SINGLE_TOKEN_SUFFIXES = new Set([
  'wifi',
  'cellular',
  'lte',
  'gps',
  'bluetooth',
  'esim',
  'physical',
  'sim',
  'dual',
  'new',
  'used',
  'premium',
  'open',
  'box',
  'edition',
]);

const LEGACY_PRODUCT_DOUBLE_TOKEN_SUFFIXES = new Set([
  'physical-esim',
  'wifi-cellular',
  'gps-cellular',
  'gps-lte',
  'premium-used',
  'open-box',
  'new-box',
  'physical-sim',
]);

const LEGACY_PRODUCT_TRIPLE_TOKEN_SUFFIXES = new Set([
  'dual-physical-sim',
  'new-open-box',
]);

const STORAGE_SUFFIX_PATTERN = /^\d+(?:gb|tb)$/;
const SIZE_SUFFIX_PATTERN = /^\d+mm$/;
const NUMERIC_TOKEN_PATTERN = /^\d+$/;

function normalizeLegacyProductIdentifier(identifier: string) {
  try {
    return decodeURIComponent(identifier).trim().toLowerCase();
  } catch {
    return identifier.trim().toLowerCase();
  }
}

function getTrailingLegacySuffixLength(tokens: string[]) {
  const tripleTokenSuffix = tokens.slice(-3).join('-');
  if (LEGACY_PRODUCT_TRIPLE_TOKEN_SUFFIXES.has(tripleTokenSuffix)) {
    return 3;
  }

  const doubleTokenSuffix = tokens.slice(-2).join('-');
  if (LEGACY_PRODUCT_DOUBLE_TOKEN_SUFFIXES.has(doubleTokenSuffix)) {
    return 2;
  }

  const lastToken = tokens.at(-1);
  const previousToken = tokens.at(-2);
  const thirdLastToken = tokens.at(-3);

  if (lastToken === 'inch' && previousToken) {
    if (
      NUMERIC_TOKEN_PATTERN.test(previousToken) &&
      thirdLastToken &&
      NUMERIC_TOKEN_PATTERN.test(thirdLastToken)
    ) {
      return 3;
    }

    if (NUMERIC_TOKEN_PATTERN.test(previousToken)) {
      return 2;
    }
  }

  if (!lastToken) {
    return 0;
  }

  if (
    STORAGE_SUFFIX_PATTERN.test(lastToken) ||
    SIZE_SUFFIX_PATTERN.test(lastToken) ||
    LEGACY_PRODUCT_SINGLE_TOKEN_SUFFIXES.has(lastToken)
  ) {
    return 1;
  }

  return 0;
}

function getLegacyProductCandidates(identifier: string) {
  const normalizedIdentifier = normalizeLegacyProductIdentifier(identifier);
  const candidates = new Set<string>();

  if (!normalizedIdentifier) {
    return [];
  }

  candidates.add(normalizedIdentifier);

  const tokens = normalizedIdentifier.split('-').filter(Boolean);
  if (tokens.length < 3) {
    return [...candidates];
  }

  let workingTokens = tokens;

  while (workingTokens.length > 2) {
    const suffixLength = getTrailingLegacySuffixLength(workingTokens);
    if (suffixLength === 0) {
      break;
    }

    workingTokens = workingTokens.slice(0, -suffixLength);
    if (workingTokens.length < 2) {
      break;
    }

    candidates.add(workingTokens.join('-'));
  }

  return [...candidates];
}

export async function resolveLegacyProductTarget(
  slug: string,
  legacyProductIdentifier: string
) {
  const merchant = isDomainIdentifier(slug)
    ? await getCachedMerchantByDomain(slug)
    : await getCachedMerchant(slug);

  if (!merchant) {
    return null;
  }

  const candidateIdentifiers = getLegacyProductCandidates(legacyProductIdentifier);
  const [primaryCandidateIdentifier, ...fallbackCandidateIdentifiers] =
    candidateIdentifiers;

  if (primaryCandidateIdentifier) {
    const primaryProduct = await getCachedProduct(
      merchant.id,
      primaryCandidateIdentifier
    );

    if (primaryProduct) {
      const primaryCategory = (
        primaryProduct.product_categories?.[0] as
          | LegacyProductCategoryJoin
          | undefined
      )?.categories;

      return getProductUrl({
        id: primaryProduct.id,
        name: primaryProduct.name,
        slug: primaryProduct.slug,
        category: primaryCategory?.name || null,
        category_slug: primaryCategory?.slug,
        categories: primaryCategory,
      });
    }
  }

  const candidateProducts = await Promise.all(
    fallbackCandidateIdentifiers.map((candidateIdentifier) =>
      getCachedProduct(merchant.id, candidateIdentifier)
    )
  );

  for (const product of candidateProducts) {
    if (!product) {
      continue;
    }

    const primaryCategory = (
      product.product_categories?.[0] as LegacyProductCategoryJoin | undefined
    )?.categories;

    return getProductUrl({
      id: product.id,
      name: product.name,
      slug: product.slug,
      category: primaryCategory?.name || null,
      category_slug: primaryCategory?.slug,
      categories: primaryCategory,
    });
  }

  return null;
}

export const cachedResolveLegacyProductTarget = cache(
  resolveLegacyProductTarget
);
