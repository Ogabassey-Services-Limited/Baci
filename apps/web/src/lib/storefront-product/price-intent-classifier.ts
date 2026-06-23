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
  PreparedPriceIntentCatalogProduct,
  PriceIntentClassification,
} from './price-intent-classifier-types';
import { productSupportsPriceIntentModifiers } from './price-intent-modifiers';

export { preparePriceIntentCatalog } from './price-intent-catalog';

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
    keywordExactTokens.every(
      (token) => entry.tokenSet.has(token) || isOptionalExactToken(entry, token)
    )
  );
}

function getProductMatchScore(
  entry: PreparedPriceIntentCatalogProduct,
  keywordTokens: Set<string>
) {
  return entry.coreTokens.filter((token) => keywordTokens.has(token)).length;
}

function getBroadHubToken(
  keywordTokens: Set<string>,
  catalog: PreparedPriceIntentCatalogProduct[],
  requestedCategorySlug: string | null
) {
  for (const entry of catalog) {
    for (const token of entry.brandTokens) {
      if (keywordTokens.has(token)) {
        return token;
      }
    }
  }

  const tokenCounts = new Map<string, number>();
  for (const entry of catalog) {
    for (const token of entry.coreTokens) {
      if (!/^\d+$/.test(token) && !GENERIC_HUB_TOKENS.has(token)) {
        tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
      }
    }
  }

  for (const token of keywordTokens) {
    if (!GENERIC_HUB_TOKENS.has(token) && (tokenCounts.get(token) ?? 0) >= 2) {
      return token;
    }
  }

  const hasGenericHubToken = Array.from(keywordTokens).some((token) =>
    GENERIC_HUB_TOKENS.has(token)
  );

  return requestedCategorySlug && !hasGenericHubToken
    ? requestedCategorySlug
    : null;
}

function getHubCategorySlug(
  requestedCategorySlug: string | null,
  entries: PreparedPriceIntentCatalogProduct[]
) {
  if (requestedCategorySlug) {
    return requestedCategorySlug;
  }

  return (
    entries.find(({ product }) => product.categorySlug)?.product.categorySlug ??
    'products'
  );
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
  result: Omit<PriceIntentClassification, 'keyword' | 'modifiers'> & {
    modifiers?: string[];
  }
): PriceIntentClassification {
  return {
    keyword: input.keyword,
    ...result,
    modifiers: result.modifiers ?? getPriceIntentModifiers(input.keyword),
  };
}

function hasPriceIntent(keyword: string) {
  return PRICE_INTENT_PATTERN.test(keyword) && !RATE_SPEC_PATTERN.test(keyword);
}

function getPreparedCatalog(input: ClassifyPriceIntentKeywordInput) {
  return (
    input.preparedCatalog ??
    preparePriceIntentCatalog(input.catalog ?? [], input.marketPhrase)
  );
}

function getExactMatches(
  preparedCatalog: PreparedPriceIntentCatalogProduct[],
  keywordTokens: Set<string>,
  stopTokens: Set<string>
) {
  return preparedCatalog
    .filter((entry) => matchesExactProduct(entry, keywordTokens, stopTokens))
    .sort(
      (left, right) =>
        getProductMatchScore(right, keywordTokens) -
          getProductMatchScore(left, keywordTokens) ||
        left.product.slug.localeCompare(right.product.slug)
    );
}

function getHubProducts(
  preparedCatalog: PreparedPriceIntentCatalogProduct[],
  hubToken: string,
  requestedCategorySlug: string | null,
  modifiers: string[]
) {
  return preparedCatalog.filter((entry) => {
    const categoryMatches =
      !requestedCategorySlug ||
      entry.product.categorySlug === requestedCategorySlug;
    const hubMatches =
      hubToken === requestedCategorySlug || entry.tokenSet.has(hubToken);

    return (
      categoryMatches &&
      hubMatches &&
      productSupportsPriceIntentModifiers(entry.product, modifiers)
    );
  });
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
    preparedCatalog,
    keywordTokens,
    stopTokens
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

  const hubToken = getBroadHubToken(
    keywordTokens,
    preparedCatalog,
    requestedCategorySlug
  );

  if (hubToken) {
    const matchedProducts = getHubProducts(
      preparedCatalog,
      hubToken,
      requestedCategorySlug,
      modifiers
    );
    const minHubProducts = Math.max(1, input.minHubProducts ?? 2);

    if (matchedProducts.length >= minHubProducts) {
      const categorySlug = getHubCategorySlug(
        requestedCategorySlug,
        matchedProducts
      );

      return buildResult(input, {
        assetKind: 'price-hub',
        reason: 'broad_cluster_price_intent',
        categorySlug,
        hubSlug: buildHubSlug(hubToken, categorySlug, input.marketPhrase),
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
