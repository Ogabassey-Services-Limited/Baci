import {
  BASE_STOP_TOKENS,
  CONDITION_TOKENS,
  GENERIC_HUB_TOKENS,
  HUB_CATEGORY_WORDS,
  SPEC_LABEL_TOKENS,
  STORAGE_PATTERN,
  STORAGE_TOKEN_PATTERN,
  UK_USED_PATTERN,
  USED_PATTERN,
} from './price-intent-classifier-constants';
import type {
  PreparedPriceIntentCatalog,
  PreparedPriceIntentCatalogProduct,
  PriceIntentCatalogProduct,
} from './price-intent-classifier-types';

export function normalizePriceIntentText(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\b(\d{1,4})\s*(gb|tb|mb)\b/gi, '$1$2')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function tokenizePriceIntentText(value: string) {
  return normalizePriceIntentText(value).split(/\s+/).filter(Boolean);
}

export function getStorageModifiers(keyword: string) {
  return Array.from(keyword.matchAll(STORAGE_PATTERN)).map((match) =>
    match[0].toLowerCase().replace(/\s+/g, '')
  );
}

export function getConditionModifiers(keyword: string) {
  if (UK_USED_PATTERN.test(keyword)) {
    return ['uk-used'];
  }

  return USED_PATTERN.test(keyword) ? ['used'] : [];
}

export function getPriceIntentModifiers(keyword: string) {
  return [...getStorageModifiers(keyword), ...getConditionModifiers(keyword)];
}

export function getPriceIntentStopTokens(
  marketPhrase: string | null | undefined
) {
  return new Set([
    ...BASE_STOP_TOKENS,
    ...HUB_CATEGORY_WORDS.keys(),
    ...SPEC_LABEL_TOKENS,
    ...tokenizePriceIntentText(marketPhrase ?? ''),
  ]);
}

export function getRequestedCategorySlug(keywordTokens: Set<string>) {
  for (const token of keywordTokens) {
    const categorySlug = HUB_CATEGORY_WORDS.get(token);

    if (categorySlug) {
      return categorySlug;
    }
  }

  return null;
}

function getCoreProductTokens(
  product: PriceIntentCatalogProduct,
  stopTokens: Set<string>,
  brandTokenSet: Set<string>
) {
  return tokenizePriceIntentText(product.name).filter(
    (token) =>
      !brandTokenSet.has(token) &&
      !stopTokens.has(token) &&
      !CONDITION_TOKENS.has(token) &&
      !STORAGE_TOKEN_PATTERN.test(token)
  );
}

export function getKeywordExactTokens(
  keywordTokens: Set<string>,
  stopTokens: Set<string>
) {
  return Array.from(keywordTokens).filter(
    (token) =>
      !stopTokens.has(token) &&
      !CONDITION_TOKENS.has(token) &&
      !STORAGE_TOKEN_PATTERN.test(token)
  );
}

function getPreparedTokenCounts(entries: PreparedPriceIntentCatalogProduct[]) {
  const tokenCounts = new Map<string, number>();

  for (const entry of entries) {
    for (const token of entry.coreTokens) {
      if (!/^\d+$/.test(token) && !GENERIC_HUB_TOKENS.has(token)) {
        tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
      }
    }
  }

  return tokenCounts;
}

function getPreparedBrandTokenSet(
  entries: PreparedPriceIntentCatalogProduct[]
) {
  return new Set(entries.flatMap((entry) => entry.brandTokens));
}

export function preparePriceIntentCatalog(
  catalog: PriceIntentCatalogProduct[],
  marketPhrase?: string | null
): PreparedPriceIntentCatalog {
  const stopTokens = getPriceIntentStopTokens(marketPhrase);
  const entries = catalog.map((product) => {
    const brandTokens = product.brand?.trim()
      ? tokenizePriceIntentText(product.brand)
      : [];
    const brandTokenSet = new Set(brandTokens);
    const coreTokens = getCoreProductTokens(product, stopTokens, brandTokenSet);
    const tokenSet = new Set([...coreTokens, ...brandTokens]);

    return { brandTokens, coreTokens, product, tokenSet };
  });

  return {
    brandTokenSet: getPreparedBrandTokenSet(entries),
    entries,
    tokenCounts: getPreparedTokenCounts(entries),
  };
}
