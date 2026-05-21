import {
  appendCountryContext,
  getCountryShoppingContext,
  getStorefrontLocale,
} from './storefront-localization';

interface ProductPriceSeoVariant {
  price_override?: number | null;
}

interface ProductPriceSeoOffer {
  price?: number | null;
}

export interface ProductPriceSeoProduct {
  name: string;
  price?: number | null;
  base_price?: number | null;
  sale_price?: number | null;
  min_variant_price?: number | null;
  max_variant_price?: number | null;
  variants?: Array<ProductPriceSeoVariant | null | undefined> | null;
  offers?: Array<ProductPriceSeoOffer | null | undefined> | null;
}

export interface ProductPriceRange {
  min: number;
  max: number;
  hasRange: boolean;
}

interface BuildProductPriceSeoCopyInput {
  product: ProductPriceSeoProduct;
  merchantDisplayName: string;
  categoryName: string;
  currency: string;
  country?: string | null;
}

function toFinitePrice(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function addPriceCandidate(
  candidates: number[],
  value: number | null | undefined
) {
  const price = toFinitePrice(value);
  if (price !== null) {
    candidates.push(price);
  }
}

export function getProductPriceRange(
  product: ProductPriceSeoProduct
): ProductPriceRange | null {
  const candidates: number[] = [];

  addPriceCandidate(
    candidates,
    toFinitePrice(product.sale_price) ??
      toFinitePrice(product.price) ??
      product.base_price
  );
  addPriceCandidate(candidates, product.min_variant_price);
  addPriceCandidate(candidates, product.max_variant_price);

  for (const variant of product.variants ?? []) {
    addPriceCandidate(candidates, variant?.price_override);
  }

  for (const offer of product.offers ?? []) {
    addPriceCandidate(candidates, offer?.price);
  }

  if (candidates.length === 0) {
    return null;
  }

  const min = Math.min(...candidates);
  const max = Math.max(...candidates);

  return {
    min,
    max,
    hasRange: min !== max,
  };
}

export function formatProductPrice(
  price: number,
  currency: string,
  locale = getStorefrontLocale()
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(price);
}

export function formatProductPriceRange(
  range: ProductPriceRange | null,
  currency: string,
  locale = getStorefrontLocale()
): string | null {
  if (!range) {
    return null;
  }

  const min = formatProductPrice(range.min, currency, locale);

  if (!range.hasRange) {
    return min;
  }

  return `${min} - ${formatProductPrice(range.max, currency, locale)}`;
}

export function buildProductPriceSeoCopy({
  product,
  merchantDisplayName,
  categoryName,
  currency,
  country,
}: BuildProductPriceSeoCopyInput) {
  const range = getProductPriceRange(product);
  const locale = getStorefrontLocale(country);
  const priceText = formatProductPriceRange(range, currency, locale);
  const category = categoryName.toLowerCase();
  const countryContext = getCountryShoppingContext(country);
  const title = appendCountryContext(`${product.name} Price`, countryContext);
  const pricePhrase = appendCountryContext(
    `${product.name} price`,
    countryContext
  );

  if (!range || !priceText) {
    return {
      title,
      description: `Check ${pricePhrase} on ${merchantDisplayName}. Review current ${category} availability, condition, delivery, warranty, and payment options before you buy.`,
      answer: `Check the current ${pricePhrase} on ${merchantDisplayName}, including availability, condition, delivery, warranty, and payment options before you buy.`,
      priceText: null,
      range,
    };
  }

  if (range.hasRange) {
    const minPrice = formatProductPrice(range.min, currency, locale);
    const maxPrice = formatProductPrice(range.max, currency, locale);

    return {
      title,
      description: `${pricePhrase} starts from ${minPrice} on ${merchantDisplayName}. Compare variants, condition, warranty, delivery, and payment options before you buy.`,
      answer: `The ${pricePhrase} on ${merchantDisplayName} starts from ${minPrice} and goes up to ${maxPrice}, depending on storage, color, condition, and availability.`,
      priceText,
      range,
    };
  }

  return {
    title,
    description: `${pricePhrase} is ${priceText} on ${merchantDisplayName}. Check specs, condition, warranty, delivery, and flexible payment options before you buy.`,
    answer: `The ${pricePhrase} on ${merchantDisplayName} is ${priceText}. Check specs, condition, warranty, delivery, and payment options before you buy.`,
    priceText,
    range,
  };
}
