import type {
  ClassifyPriceIntentKeywordInput,
  PriceIntentCatalogProduct,
  PriceIntentClassification,
} from './price-intent-classifier-types';

const PRICE_INTENT_PATTERN = /\b(price|prices|cost|how\s+much)\b/i;
const STORAGE_PATTERN = /\b\d{2,4}\s?gb\b/gi;
const UK_USED_PATTERN = /\b(?:uk\s*used|uk-used|tokunbo)\b/i;
const USED_PATTERN = /\bused\b/i;
const HUB_CATEGORY_WORDS = new Map([
  ['phone', 'smartphones'],
  ['phones', 'smartphones'],
  ['smartphone', 'smartphones'],
  ['smartphones', 'smartphones'],
  ['laptop', 'laptops'],
  ['laptops', 'laptops'],
  ['tablet', 'tablets'],
  ['tablets', 'tablets'],
  ['drone', 'drones'],
  ['drones', 'drones'],
]);
const STOP_TOKENS = new Set(
  'a an and buy cost for how in is much nigeria of phone phones price prices the'.split(
    ' '
  )
);
const CONDITION_TOKENS = new Set('uk used tokunbo'.split(' '));

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
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

function getCoreProductTokens(product: PriceIntentCatalogProduct) {
  return tokenize(product.name).filter(
    (token) =>
      !STOP_TOKENS.has(token) &&
      !CONDITION_TOKENS.has(token) &&
      !/^\d{2,4}gb$/.test(token)
  );
}

function productHasStorage(
  product: PriceIntentCatalogProduct,
  storageModifier: string
) {
  const storageValue = Number.parseInt(storageModifier, 10);
  if (getStorageModifiers(product.name).includes(storageModifier)) {
    return true;
  }

  return Object.entries(product.productKeySpecs ?? {}).some(([key, value]) => {
    const normalizedKey = normalizeText(key);

    if (!normalizedKey.includes('storage')) {
      return false;
    }

    if (typeof value === 'number') {
      return value === storageValue;
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
    if (/^\d{2,4}gb$/.test(modifier)) {
      return productHasStorage(product, modifier);
    }

    return productHasCondition(product, modifier);
  });
}

function matchesExactProduct(
  product: PriceIntentCatalogProduct,
  keywordTokens: Set<string>
) {
  const coreTokens = getCoreProductTokens(product);

  return (
    coreTokens.length > 0 &&
    coreTokens.every((token) => keywordTokens.has(token))
  );
}

function getProductMatchScore(
  product: PriceIntentCatalogProduct,
  keywordTokens: Set<string>
) {
  return getCoreProductTokens(product).filter((token) =>
    keywordTokens.has(token)
  ).length;
}

function getBroadHubToken(
  keywordTokens: Set<string>,
  catalog: PriceIntentCatalogProduct[]
) {
  const brandTokens = catalog
    .map((product) => product.brand)
    .filter((brand): brand is string => Boolean(brand?.trim()))
    .flatMap((brand) => tokenize(brand));

  for (const token of brandTokens) {
    if (keywordTokens.has(token)) {
      return token;
    }
  }

  const productTokens = catalog
    .flatMap((product) => getCoreProductTokens(product))
    .filter((token) => !/^\d+$/.test(token));
  const tokenCounts = new Map<string, number>();

  for (const token of productTokens) {
    tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
  }

  for (const token of keywordTokens) {
    if ((tokenCounts.get(token) ?? 0) >= 2) {
      return token;
    }
  }

  return null;
}

function getHubCategorySlug(
  keywordTokens: Set<string>,
  products: PriceIntentCatalogProduct[]
) {
  for (const token of keywordTokens) {
    const categorySlug = HUB_CATEGORY_WORDS.get(token);

    if (categorySlug) {
      return categorySlug;
    }
  }

  return (
    products.find((product) => product.categorySlug)?.categorySlug ?? 'products'
  );
}

function slugify(value: string) {
  return normalizeText(value).replace(/\s+/g, '-');
}

function buildHubSlug(hubToken: string, categorySlug: string) {
  return `${slugify(`${hubToken} ${categorySlug} price in Nigeria`)}`;
}

function buildResult(
  input: ClassifyPriceIntentKeywordInput,
  result: Omit<PriceIntentClassification, 'keyword' | 'modifiers'> & {
    modifiers?: string[];
  }
): PriceIntentClassification {
  return {
    keyword: input.keyword,
    modifiers: result.modifiers ?? getModifiers(input.keyword),
    ...result,
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

  const keywordTokens = new Set(tokenize(input.keyword));
  const exactMatches = input.catalog
    .filter((product) => matchesExactProduct(product, keywordTokens))
    .sort(
      (left, right) =>
        getProductMatchScore(right, keywordTokens) -
          getProductMatchScore(left, keywordTokens) ||
        left.slug.localeCompare(right.slug)
    );
  const supportedExactMatch = exactMatches.find((product) =>
    productSupportsModifiers(product, modifiers)
  );

  if (supportedExactMatch) {
    return buildResult(input, {
      assetKind: 'pdp',
      reason: modifiers.length
        ? 'exact_product_with_modifiers'
        : 'exact_product',
      targetSlug: supportedExactMatch.slug,
      categorySlug: supportedExactMatch.categorySlug ?? 'products',
      modifiers,
    });
  }

  if (exactMatches.length > 0 && modifiers.length > 0) {
    return buildResult(input, {
      assetKind: 'no-catalog',
      reason: 'modifier_not_supported_by_catalog',
      nearestProductSlug: exactMatches[0]?.slug,
      categorySlug: exactMatches[0]?.categorySlug ?? 'products',
      modifiers,
    });
  }

  const hubToken = getBroadHubToken(keywordTokens, input.catalog);

  if (hubToken) {
    const matchedProducts = input.catalog.filter((product) => {
      const productTokens = new Set([
        ...getCoreProductTokens(product),
        ...tokenize(product.brand ?? ''),
      ]);

      return (
        productTokens.has(hubToken) &&
        productSupportsModifiers(product, modifiers)
      );
    });
    const minHubProducts = Math.max(1, input.minHubProducts ?? 2);

    if (matchedProducts.length >= minHubProducts) {
      const categorySlug = getHubCategorySlug(keywordTokens, matchedProducts);

      return buildResult(input, {
        assetKind: 'price-hub',
        reason: 'broad_cluster_price_intent',
        categorySlug,
        hubSlug: buildHubSlug(hubToken, categorySlug),
        matchedProductSlugs: matchedProducts.map((product) => product.slug),
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
