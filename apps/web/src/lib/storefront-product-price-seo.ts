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
}

function toFinitePrice(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
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

  addPriceCandidate(candidates, product.sale_price);
  addPriceCandidate(candidates, product.price);
  addPriceCandidate(candidates, product.base_price);
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

export function formatProductPrice(price: number, currency: string): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(price);
}

export function formatProductPriceRange(
  range: ProductPriceRange | null,
  currency: string
): string | null {
  if (!range) {
    return null;
  }

  const min = formatProductPrice(range.min, currency);

  if (!range.hasRange) {
    return min;
  }

  return `${min} - ${formatProductPrice(range.max, currency)}`;
}

export function buildProductPriceSeoCopy({
  product,
  merchantDisplayName,
  categoryName,
  currency,
}: BuildProductPriceSeoCopyInput) {
  const range = getProductPriceRange(product);
  const priceText = formatProductPriceRange(range, currency);
  const category = categoryName.toLowerCase();

  if (!range || !priceText) {
    return {
      title: `${product.name} Price in Nigeria`,
      description: `Check ${product.name} price in Nigeria on ${merchantDisplayName}. Review current ${category} availability, condition, delivery, warranty, and payment options before you buy.`,
      answer: `Check the current ${product.name} price in Nigeria on ${merchantDisplayName}, including availability, condition, delivery, warranty, and payment options before you buy.`,
      priceText: null,
      range,
    };
  }

  if (range.hasRange) {
    return {
      title: `${product.name} Price in Nigeria`,
      description: `${product.name} price in Nigeria starts from ${formatProductPrice(range.min, currency)} on ${merchantDisplayName}. Compare variants, condition, warranty, delivery, and payment options before you buy.`,
      answer: `The ${product.name} price in Nigeria on ${merchantDisplayName} starts from ${formatProductPrice(range.min, currency)} and goes up to ${formatProductPrice(range.max, currency)}, depending on storage, color, condition, and availability.`,
      priceText,
      range,
    };
  }

  return {
    title: `${product.name} Price in Nigeria`,
    description: `${product.name} price in Nigeria is ${priceText} on ${merchantDisplayName}. Check specs, condition, warranty, delivery, and flexible payment options before you buy.`,
    answer: `The ${product.name} price in Nigeria on ${merchantDisplayName} is ${priceText}. Check specs, condition, warranty, delivery, and payment options before you buy.`,
    priceText,
    range,
  };
}
