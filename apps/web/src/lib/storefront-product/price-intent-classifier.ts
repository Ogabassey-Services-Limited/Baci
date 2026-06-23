import {
  BASE_STOP_TOKENS,
  CONDITION_TOKENS,
  GENERIC_HUB_TOKENS,
  HUB_CATEGORY_WORDS,
  OPTIONAL_EXACT_TOKENS,
  PRICE_INTENT_PATTERN,
  STORAGE_PATTERN,
  STORAGE_TOKEN_PATTERN,
  UK_USED_PATTERN,
  USED_PATTERN,
} from './price-intent-classifier-constants';
import type {
  ClassifyPriceIntentKeywordInput,
  PreparedPriceIntentCatalogProduct,
  PriceIntentCatalogProduct,
  PriceIntentClassification,
} from './price-intent-classifier-types';

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\b(\d{1,4})\s*(gb|tb|mb)\b/gi, '$1$2')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(value: string) {
  return normalizeText(value).split(/\s+/).filter(Boolean);
}

function getStorageModifiers(keyword: string) {
  return Array.from(keyword.matchAll(STORAGE_PATTERN)).map((match) =>
    match[0].toLowerCase().replace(/\s+/g, '')
  );
}

function getConditionModifiers(keyword: string) {
  if (UK_USED_PATTERN.test(keyword)) {
    return ['uk-used'];
  }

  return USED_PATTERN.test(keyword) ? ['used'] : [];
}

function getModifiers(keyword: string) {
  return [...getStorageModifiers(keyword), ...getConditionModifiers(keyword)];
}

function getStopTokens(marketPhrase: string | null | undefined) {
  return new Set([...BASE_STOP_TOKENS, ...tokenize(marketPhrase ?? '')]);
}

function getCoreProductTokens(
  product: PriceIntentCatalogProduct,
  stopTokens: Set<string>
) {
  return tokenize(product.name).filter(
    (token) =>
      !stopTokens.has(token) &&
      !CONDITION_TOKENS.has(token) &&
      !STORAGE_TOKEN_PATTERN.test(token)
  );
}

export function preparePriceIntentCatalog(
  catalog: PriceIntentCatalogProduct[],
  marketPhrase?: string | null
): PreparedPriceIntentCatalogProduct[] {
  const stopTokens = getStopTokens(marketPhrase);

  return catalog.map((product) => {
    const coreTokens = getCoreProductTokens(product, stopTokens);
    const brandTokens = product.brand?.trim() ? tokenize(product.brand) : [];
    const tokenSet = new Set([...coreTokens, ...brandTokens]);

    return { brandTokens, coreTokens, product, tokenSet };
  });
}

function parseStorageModifier(modifier: string) {
  const match = /^(\d{1,4})(gb|tb|mb)$/.exec(modifier);
  if (!match) return null;

  return {
    unit: match[2],
    value: Number.parseInt(match[1], 10),
  };
}

function productHasStorage(
  product: PriceIntentCatalogProduct,
  storageModifier: string
) {
  const parsedStorage = parseStorageModifier(storageModifier);
  if (!parsedStorage) return false;

  if (getStorageModifiers(product.name).includes(storageModifier)) {
    return true;
  }

  return Object.entries(product.productKeySpecs ?? {}).some(([key, value]) => {
    const normalizedKey = normalizeText(key);

    if (!normalizedKey.includes('storage') && !normalizedKey.includes('ram')) {
      return false;
    }

    if (typeof value === 'number') {
      return (
        parsedStorage.unit === 'gb' &&
        normalizedKey.includes('gb') &&
        value === parsedStorage.value
      );
    }

    return normalizeText(String(value)).replace(/\s+/g, '') === storageModifier;
  });
}

function productHasCondition(
  product: PriceIntentCatalogProduct,
  modifier: string
) {
  const conditionText = normalizeText(
    `${product.condition ?? ''} ${product.name}`
  );

  if (modifier === 'uk-used') {
    return (
      conditionText.includes('uk used') || conditionText.includes('tokunbo')
    );
  }

  return modifier === 'used' ? tokenize(conditionText).includes('used') : true;
}

function productSupportsModifiers(
  product: PriceIntentCatalogProduct,
  modifiers: string[]
) {
  return modifiers.every((modifier) => {
    if (STORAGE_TOKEN_PATTERN.test(modifier)) {
      return productHasStorage(product, modifier);
    }

    return productHasCondition(product, modifier);
  });
}

function matchesExactProduct(
  entry: PreparedPriceIntentCatalogProduct,
  keywordTokens: Set<string>
) {
  const requiredTokens = entry.coreTokens.filter(
    (token) => !OPTIONAL_EXACT_TOKENS.has(token)
  );
  return (
    requiredTokens.length > 0 &&
    requiredTokens.every((token) => keywordTokens.has(token))
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
  catalog: PreparedPriceIntentCatalogProduct[]
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

  return null;
}

function getHubCategorySlug(
  keywordTokens: Set<string>,
  entries: PreparedPriceIntentCatalogProduct[]
) {
  for (const token of keywordTokens) {
    const categorySlug = HUB_CATEGORY_WORDS.get(token);

    if (categorySlug) {
      return categorySlug;
    }
  }

  return (
    entries.find(({ product }) => product.categorySlug)?.product.categorySlug ??
    'products'
  );
}

function slugify(value: string) {
  return normalizeText(value).replace(/\s+/g, '-');
}

function buildHubSlug(
  hubToken: string,
  categorySlug: string,
  marketPhrase: string | null | undefined
) {
  const localizedSuffix = marketPhrase ? ` in ${marketPhrase}` : '';
  return slugify(`${hubToken} ${categorySlug} price${localizedSuffix}`);
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
    modifiers: result.modifiers ?? getModifiers(input.keyword),
  };
}

export function classifyPriceIntentKeyword(
  input: ClassifyPriceIntentKeywordInput
): PriceIntentClassification {
  const modifiers = getModifiers(input.keyword);

  if (!PRICE_INTENT_PATTERN.test(input.keyword)) {
    return buildResult(input, {
      assetKind: 'ignore',
      reason: 'not_price_intent',
      modifiers,
    });
  }

  const preparedCatalog =
    input.preparedCatalog ??
    preparePriceIntentCatalog(input.catalog, input.marketPhrase);
  const keywordTokens = new Set(tokenize(input.keyword));
  const exactMatches = preparedCatalog
    .filter((entry) => matchesExactProduct(entry, keywordTokens))
    .sort(
      (left, right) =>
        getProductMatchScore(right, keywordTokens) -
          getProductMatchScore(left, keywordTokens) ||
        left.product.slug.localeCompare(right.product.slug)
    );
  const supportedExactMatch = exactMatches.find(({ product }) =>
    productSupportsModifiers(product, modifiers)
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

  const hubToken = getBroadHubToken(keywordTokens, preparedCatalog);

  if (hubToken) {
    const matchedProducts = preparedCatalog.filter((entry) => {
      return (
        entry.tokenSet.has(hubToken) &&
        productSupportsModifiers(entry.product, modifiers)
      );
    });
    const minHubProducts = Math.max(1, input.minHubProducts ?? 2);

    if (matchedProducts.length >= minHubProducts) {
      const categorySlug = getHubCategorySlug(keywordTokens, matchedProducts);

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
