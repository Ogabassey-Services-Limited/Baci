import {
  getKeywordExactTokens,
  getPriceIntentModifiers,
  getPriceIntentStopTokens,
  getRequestedCategorySlug,
  normalizePriceIntentText,
  preparePriceIntentCatalog,
  tokenizePriceIntentText,
} from './price-intent-catalog';
import {
  GENERIC_HUB_TOKENS,
  OPTIONAL_EXACT_TOKENS,
  PRICE_INTENT_PATTERN,
  RATE_SPEC_PATTERN,
} from './price-intent-classifier-constants';
import type {
  ClassifyPriceIntentKeywordInput,
  PreparedPriceIntentCatalog,
  PreparedPriceIntentCatalogProduct,
  PriceIntentClassification,
} from './price-intent-classifier-types';
import { productSupportsPriceIntentModifiers } from './price-intent-modifiers';

type HubMatch = { kind: 'brand' | 'category' | 'shared-token'; token: string };

function isOptionalExactToken(
  entry: PreparedPriceIntentCatalogProduct,
  token: string
) {
  if (token === 'dual') {
    return entry.coreTokens.includes('sim');
  }

  return OPTIONAL_EXACT_TOKENS.has(token);
}

function matchesExactProduct(
  entry: PreparedPriceIntentCatalogProduct,
  keywordTokens: Set<string>,
  stopTokens: Set<string>
) {
  const requiredTokens = entry.coreTokens.filter(
    (token) => !isOptionalExactToken(entry, token)
  );
  const keywordExactTokens = getKeywordExactTokens(keywordTokens, stopTokens);

  return (
    requiredTokens.length > 0 &&
    requiredTokens.every((token) => keywordTokens.has(token)) &&
    keywordExactTokens.every((token) => entry.tokenSet.has(token))
  );
}

function getProductMatchScore(
  entry: PreparedPriceIntentCatalogProduct,
  keywordTokens: Set<string>
) {
  return entry.coreTokens.filter((token) => keywordTokens.has(token)).length;
}

function getBroadHubMatch(
  keywordTokens: Set<string>,
  preparedCatalog: PreparedPriceIntentCatalog,
  requestedCategorySlug: string | null
): HubMatch | null {
  for (const token of keywordTokens) {
    if (preparedCatalog.brandTokenSet.has(token)) {
      return { kind: 'brand', token };
    }
  }

  for (const token of keywordTokens) {
    if (
      !GENERIC_HUB_TOKENS.has(token) &&
      (preparedCatalog.tokenCounts.get(token) ?? 0) >= 2
    ) {
      return { kind: 'shared-token', token };
    }
  }

  return requestedCategorySlug &&
    !Array.from(keywordTokens).some((token) => GENERIC_HUB_TOKENS.has(token))
    ? { kind: 'category', token: requestedCategorySlug }
    : null;
}

function getHubCategorySlug(
  requestedCategorySlug: string | null,
  entries: PreparedPriceIntentCatalogProduct[]
) {
  if (requestedCategorySlug) {
    return requestedCategorySlug;
  }

  const categoryCounts = new Map<string, number>();

  for (const { product } of entries) {
    if (product.categorySlug) {
      categoryCounts.set(
        product.categorySlug,
        (categoryCounts.get(product.categorySlug) ?? 0) + 1
      );
    }
  }

  let bestCategory = 'products';
  let bestCount = 0;

  for (const [categorySlug, count] of categoryCounts) {
    if (count > bestCount) {
      bestCategory = categorySlug;
      bestCount = count;
    }
  }

  return bestCategory;
}

function slugify(value: string) {
  return normalizePriceIntentText(value).replace(/\s+/g, '-');
}

function buildHubSlug(
  hubToken: string,
  categorySlug: string,
  marketPhrase: string | null | undefined
) {
  const hubName =
    hubToken === categorySlug ? categorySlug : `${hubToken} ${categorySlug}`;
  const localizedSuffix = marketPhrase ? ` in ${marketPhrase}` : '';
  return slugify(`${hubName} price${localizedSuffix}`);
}

function buildResult(
  input: ClassifyPriceIntentKeywordInput,
  result: Omit<PriceIntentClassification, 'keyword'>
): PriceIntentClassification {
  return {
    keyword: input.keyword,
    ...result,
  };
}

function hasPriceIntent(keyword: string) {
  return PRICE_INTENT_PATTERN.test(keyword) && !RATE_SPEC_PATTERN.test(keyword);
}

function getPreparedCatalog(input: ClassifyPriceIntentKeywordInput) {
  if (input.preparedCatalog) {
    return input.preparedCatalog;
  }

  return preparePriceIntentCatalog(input.catalog ?? [], input.marketPhrase);
}

function getExactMatches(
  preparedCatalog: PreparedPriceIntentCatalogProduct[],
  keywordTokens: Set<string>,
  stopTokens: Set<string>,
  requestedCategorySlug: string | null
) {
  return preparedCatalog
    .filter(
      (entry) =>
        (!requestedCategorySlug ||
          entry.product.categorySlug === requestedCategorySlug) &&
        matchesExactProduct(entry, keywordTokens, stopTokens)
    )
    .sort(
      (left, right) =>
        getProductMatchScore(right, keywordTokens) -
          getProductMatchScore(left, keywordTokens) ||
        left.product.slug.localeCompare(right.product.slug)
    );
}

function matchesHub(
  entry: PreparedPriceIntentCatalogProduct,
  hubMatch: HubMatch
) {
  if (hubMatch.kind === 'category') {
    return entry.product.categorySlug === hubMatch.token;
  }

  if (hubMatch.kind === 'brand') {
    return entry.brandTokens.includes(hubMatch.token);
  }

  return entry.tokenSet.has(hubMatch.token);
}

function getHubProducts(
  preparedCatalog: PreparedPriceIntentCatalogProduct[],
  hubMatch: HubMatch,
  requestedCategorySlug: string | null,
  modifiers: string[]
) {
  const hubCandidates = preparedCatalog.filter(
    (entry) =>
      matchesHub(entry, hubMatch) &&
      (!requestedCategorySlug ||
        entry.product.categorySlug === requestedCategorySlug) &&
      productSupportsPriceIntentModifiers(entry.product, modifiers)
  );
  const categorySlug = getHubCategorySlug(requestedCategorySlug, hubCandidates);
  const products = hubCandidates.filter(
    ({ product }) =>
      categorySlug === 'products' || product.categorySlug === categorySlug
  );

  return { categorySlug, products };
}

export function classifyPriceIntentKeyword(
  input: ClassifyPriceIntentKeywordInput
): PriceIntentClassification {
  const modifiers = getPriceIntentModifiers(input.keyword);

  if (!hasPriceIntent(input.keyword)) {
    return buildResult(input, {
      assetKind: 'ignore',
      reason: 'not_price_intent',
      modifiers,
    });
  }

  const preparedCatalog = getPreparedCatalog(input);
  const keywordTokens = new Set(tokenizePriceIntentText(input.keyword));
  const stopTokens = getPriceIntentStopTokens(input.marketPhrase);
  const requestedCategorySlug = getRequestedCategorySlug(keywordTokens);
  const exactMatches = getExactMatches(
    preparedCatalog.entries,
    keywordTokens,
    stopTokens,
    requestedCategorySlug
  );
  const supportedExactMatch = exactMatches.find(({ product }) =>
    productSupportsPriceIntentModifiers(product, modifiers)
  );

  if (supportedExactMatch) {
    return buildResult(input, {
      assetKind: 'pdp',
      reason: modifiers.length
        ? 'exact_product_with_modifiers'
        : 'exact_product',
      targetSlug: supportedExactMatch.product.slug,
      categorySlug: supportedExactMatch.product.categorySlug ?? 'products',
      modifiers,
    });
  }

  if (exactMatches.length > 0 && modifiers.length > 0) {
    return buildResult(input, {
      assetKind: 'no-catalog',
      reason: 'modifier_not_supported_by_catalog',
      nearestProductSlug: exactMatches[0]?.product.slug,
      categorySlug: exactMatches[0]?.product.categorySlug ?? 'products',
      modifiers,
    });
  }

  const hubMatch = getBroadHubMatch(
    keywordTokens,
    preparedCatalog,
    requestedCategorySlug
  );

  if (hubMatch) {
    const { categorySlug, products: matchedProducts } = getHubProducts(
      preparedCatalog.entries,
      hubMatch,
      requestedCategorySlug,
      modifiers
    );
    const minHubProducts = Math.max(1, input.minHubProducts ?? 2);

    if (matchedProducts.length >= minHubProducts) {
      return buildResult(input, {
        assetKind: 'price-hub',
        reason: 'broad_cluster_price_intent',
        categorySlug,
        hubSlug: buildHubSlug(hubMatch.token, categorySlug, input.marketPhrase),
        matchedProductSlugs: matchedProducts.map(({ product }) => product.slug),
        modifiers,
      });
    }
  }

  return buildResult(input, {
    assetKind: 'no-catalog',
    reason: 'no_matching_catalog_entity',
    modifiers,
  });
}
