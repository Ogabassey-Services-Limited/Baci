import {
  getStorageModifiers,
  normalizePriceIntentText,
  tokenizePriceIntentText,
} from './price-intent-catalog';
import { STORAGE_TOKEN_PATTERN } from './price-intent-classifier-constants';
import type { PriceIntentCatalogProduct } from './price-intent-classifier-types';

function parseStorageModifier(modifier: string) {
  const match = /^(\d{1,4})(gb|tb|mb)$/.exec(modifier);
  if (!match) return null;

  return {
    unit: match[2],
    value: Number.parseInt(match[1], 10),
  };
}

function getNumericSpecUnit(normalizedKey: string) {
  if (normalizedKey.includes('tb')) return 'tb';
  if (normalizedKey.includes('mb')) return 'mb';
  if (normalizedKey.includes('gb')) return 'gb';

  return normalizedKey.includes('storage') || normalizedKey.includes('ram')
    ? 'gb'
    : null;
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
    const normalizedKey = normalizePriceIntentText(key);

    if (!normalizedKey.includes('storage') && !normalizedKey.includes('ram')) {
      return false;
    }

    if (typeof value === 'number') {
      return (
        getNumericSpecUnit(normalizedKey) === parsedStorage.unit &&
        value === parsedStorage.value
      );
    }

    return (
      normalizePriceIntentText(String(value)).replace(/\s+/g, '') ===
      storageModifier
    );
  });
}

function productHasCondition(
  product: PriceIntentCatalogProduct,
  modifier: string
) {
  const conditionText = normalizePriceIntentText(
    `${product.condition ?? ''} ${product.name}`
  );

  if (modifier === 'uk-used') {
    return (
      conditionText.includes('uk used') || conditionText.includes('tokunbo')
    );
  }

  return modifier === 'used'
    ? tokenizePriceIntentText(conditionText).includes('used')
    : true;
}

export function productSupportsPriceIntentModifiers(
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
