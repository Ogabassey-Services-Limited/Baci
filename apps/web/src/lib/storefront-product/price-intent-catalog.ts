import {
  BASE_STOP_TOKENS,
  CONDITION_TOKENS,
  HUB_CATEGORY_WORDS,
  STORAGE_PATTERN,
  STORAGE_TOKEN_PATTERN,
  UK_USED_PATTERN,
  USED_PATTERN,
} from './price-intent-classifier-constants';
import type {
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
  stopTokens: Set<string>
) {
  return tokenizePriceIntentText(product.name).filter(
    (token) =>
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

export function preparePriceIntentCatalog(
  catalog: PriceIntentCatalogProduct[],
  marketPhrase?: string | null
): PreparedPriceIntentCatalogProduct[] {
  const stopTokens = getPriceIntentStopTokens(marketPhrase);

  return catalog.map((product) => {
    const coreTokens = getCoreProductTokens(product, stopTokens);
    const brandTokens = product.brand?.trim()
      ? tokenizePriceIntentText(product.brand)
      : [];
    const tokenSet = new Set([...coreTokens, ...brandTokens]);

    return { brandTokens, coreTokens, product, tokenSet };
  });
}
