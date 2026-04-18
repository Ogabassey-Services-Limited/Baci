import {
  getStorefrontOpenGraphImages,
  getStorefrontTwitterImages,
} from './storefront-social-images';

type ProductImageCandidate =
  | string
  | {
      url?: string | null;
      alt?: string | null;
    };

interface StorefrontProductSocialMetadataInput {
  name: string;
  image?: string | null;
  imageLarge?: string | null;
  images?: Array<ProductImageCandidate | null | undefined> | null;
  price?: number | null;
  base_price?: number | null;
  sale_price?: number | null;
  stock_quantity?: number | null;
  quantity?: number | null;
  manage_stock?: boolean | null;
  track_quantity?: boolean | null;
  condition?: string | null;
}

function getPrimaryProductImage(
  product: StorefrontProductSocialMetadataInput
): string | null {
  for (const image of product.images || []) {
    if (typeof image === 'string' && image.trim()) {
      return image;
    }

    if (
      image &&
      typeof image === 'object' &&
      typeof image.url === 'string' &&
      image.url.trim()
    ) {
      return image.url;
    }
  }

  return product.imageLarge || product.image || null;
}

function getProductPriceAmount(
  product: StorefrontProductSocialMetadataInput
): number | null {
  const rawPrice =
    product.sale_price ?? product.price ?? product.base_price ?? null;
  return typeof rawPrice === 'number' && Number.isFinite(rawPrice)
    ? rawPrice
    : null;
}

function getProductAvailability(
  product: StorefrontProductSocialMetadataInput
): 'in stock' | 'out of stock' | undefined {
  const managesStock = Boolean(
    product.manage_stock ?? product.track_quantity ?? false
  );
  const stockQuantity = product.stock_quantity ?? product.quantity;

  if (!managesStock) {
    return 'in stock';
  }

  if (typeof stockQuantity === 'number') {
    return stockQuantity > 0 ? 'in stock' : 'out of stock';
  }

  return undefined;
}

function normalizeCondition(condition: string | null | undefined) {
  const normalized = condition?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (normalized === 'open_box') {
    return 'used';
  }

  return normalized;
}

export function getStorefrontProductSocialMetadata(
  baseUrl: string,
  product: StorefrontProductSocialMetadataInput,
  currency: string
) {
  const primaryImage = getPrimaryProductImage(product);
  const priceAmount = getProductPriceAmount(product);
  const availability = getProductAvailability(product);
  const condition = normalizeCondition(product.condition);

  const other: Record<string, string> = {};

  if (priceAmount !== null) {
    other['product:price:amount'] = String(priceAmount);
    other['product:price:currency'] = currency;
    other['twitter:label1'] = 'Price';
    other['twitter:data1'] = `${currency} ${priceAmount}`;
  }

  if (availability) {
    other['product:availability'] = availability;
    other['twitter:label2'] = 'Availability';
    other['twitter:data2'] =
      availability === 'in stock' ? 'In stock' : 'Out of stock';
  }

  if (condition) {
    other['product:condition'] = condition;
  }

  return {
    openGraphImages: getStorefrontOpenGraphImages(
      baseUrl,
      product.name,
      primaryImage
    ),
    twitterImages: getStorefrontTwitterImages(baseUrl, primaryImage),
    other,
  };
}
