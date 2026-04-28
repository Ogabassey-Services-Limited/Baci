import { getEffectiveStock } from '@/lib/product-stock';
import { stripHtmlTags } from '@/lib/sanitize-core';
import {
  buildAgentPolicyUrls,
  buildAgentProductUrl,
  trimTrailingSlash,
} from '@/lib/storefront-agent-urls';
import {
  DEFAULT_RETURN_DAYS,
  PRODUCT_DESCRIPTION_MAX_LENGTH,
} from './feed-constants';
import type { OpenAIFeedVariant } from './feed-data';
import type { Merchant, OpenAIFeedItem, Product } from './feed-types';

const UNLIMITED_STOCK_QUANTITY = 9999;

function getVariantStockCount(
  product: Pick<Product, 'manage_stock'>,
  variant: OpenAIFeedVariant
) {
  if (product.manage_stock === false) {
    // Product-level unmanaged stock is authoritative for the feed. Variant
    // quantities are hidden/zeroed in this mode and there is no variant-level
    // availability override in the product_variants feed contract.
    return UNLIMITED_STOCK_QUANTITY;
  }

  return typeof variant.stock_quantity === 'number'
    ? Math.max(0, variant.stock_quantity)
    : 0;
}

function getProductImageUrl(product: Product, variant?: OpenAIFeedVariant) {
  const parentFirstImageRaw = product.images?.[0];
  const parentFirstImage =
    typeof parentFirstImageRaw === 'string'
      ? parentFirstImageRaw
      : parentFirstImageRaw?.url || '';

  return variant?.primary_image || parentFirstImage;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function getAdditionalImageLinks(product: Product) {
  return product.images
    ?.slice(1, 11)
    .map((img) => (typeof img === 'string' ? img : img.url))
    .filter(isString);
}

function buildVariantTitle(product: Product, variant: OpenAIFeedVariant) {
  const color = variant.attributes?.color || variant.attributes?.Color;
  const size = variant.attributes?.size || variant.attributes?.Size;
  const storage = variant.attributes?.storage || variant.attributes?.Storage;
  const titleParts = [product.name];

  if (color) {
    titleParts.push(color);
  }
  if (size) {
    titleParts.push(size);
  }

  if (storage) {
    titleParts.push(storage);
  }

  return titleParts.join(' - ');
}

function buildVariantFeedItem({
  product,
  variant,
  merchant,
  baseUrl,
  currency,
  merchantUrl,
}: {
  product: Product;
  variant: OpenAIFeedVariant;
  merchant: Merchant;
  baseUrl: string;
  currency: string;
  merchantUrl: string;
}): OpenAIFeedItem | null {
  const finalPrice = variant.price_override ?? product.price;
  const itemId = variant.sku || variant.id;

  if (!itemId || !Number.isFinite(finalPrice) || finalPrice <= 0) {
    return null;
  }

  const stockCount = getVariantStockCount(product, variant);
  const availability: OpenAIFeedItem['availability'] =
    stockCount > 0 ? 'in_stock' : 'out_of_stock';
  const color = variant.attributes?.color || variant.attributes?.Color;
  const size = variant.attributes?.size || variant.attributes?.Size;

  return {
    enable_search: true,
    enable_checkout: true,
    id: itemId,
    item_group_id: product.id,
    gtin: product.gtin || undefined,
    mpn: product.mpn || undefined,
    title: buildVariantTitle(product, variant),
    description: stripHtmlTags(product.description || '')
      .trim()
      .slice(0, PRODUCT_DESCRIPTION_MAX_LENGTH),
    link: buildAgentProductUrl({ baseUrl, product }),
    condition: product.condition || 'new',
    product_type: product.category || product.google_product_category,
    brand: product.brand || merchant.business_name,
    image_link: getProductImageUrl(product, variant),
    additional_image_links: getAdditionalImageLinks(product),
    price: `${finalPrice.toFixed(2)} ${currency}`,
    availability,
    quantity: stockCount,
    color,
    size,
    merchant_name: merchant.business_name,
    merchant_url: merchantUrl,
    ...buildAgentPolicyUrls(baseUrl),
    return_days: DEFAULT_RETURN_DAYS,
  };
}

function buildSimpleFeedItem({
  product,
  merchant,
  baseUrl,
  currency,
  merchantUrl,
}: {
  product: Product;
  merchant: Merchant;
  baseUrl: string;
  currency: string;
  merchantUrl: string;
}): OpenAIFeedItem | null {
  const itemId = product.sku || product.id;

  if (!itemId || !Number.isFinite(product.price) || product.price <= 0) {
    return null;
  }

  const stockCount =
    product.manage_stock === false
      ? UNLIMITED_STOCK_QUANTITY
      : getEffectiveStock(product);
  const availability: OpenAIFeedItem['availability'] =
    stockCount > 0 ? 'in_stock' : 'out_of_stock';
  const formattedPrice = `${product.price.toFixed(2)} ${currency}`;
  const salePrice =
    product.compare_at_price && product.compare_at_price > product.price
      ? formattedPrice
      : undefined;
  const regularPrice =
    product.compare_at_price && product.compare_at_price > product.price
      ? `${product.compare_at_price.toFixed(2)} ${currency}`
      : formattedPrice;
  const shippingWeight =
    product.weight_value && product.weight_unit
      ? `${product.weight_value} ${product.weight_unit}`
      : undefined;

  return {
    enable_search: true,
    enable_checkout: true,
    id: itemId,
    gtin: product.gtin || undefined,
    mpn: product.mpn || undefined,
    title: product.name,
    description: stripHtmlTags(product.description || '')
      .trim()
      .slice(0, PRODUCT_DESCRIPTION_MAX_LENGTH),
    link: buildAgentProductUrl({ baseUrl, product }),
    condition: product.condition || 'new',
    product_type: product.category || product.google_product_category,
    brand: product.brand || merchant.business_name,
    image_link: getProductImageUrl(product),
    additional_image_links: getAdditionalImageLinks(product),
    price: regularPrice,
    sale_price: salePrice,
    availability,
    quantity: stockCount,
    shipping_weight: shippingWeight,
    merchant_name: merchant.business_name,
    merchant_url: merchantUrl,
    ...buildAgentPolicyUrls(baseUrl),
    return_days: DEFAULT_RETURN_DAYS,
  };
}

function stringifyFeedItem(feedItem: OpenAIFeedItem) {
  const cleanItem = Object.fromEntries(
    Object.entries(feedItem).filter(([, value]) => value !== undefined)
  );

  return JSON.stringify(cleanItem);
}

export function generateOpenAIFeed(
  products: Product[],
  merchant: Merchant,
  baseUrl: string
): string[] {
  const currency = merchant.payout_currency || 'NGN';
  const merchantUrl = trimTrailingSlash(baseUrl);
  const feedItems: string[] = [];
  const validProducts = products.filter(
    (product) => product.name && product.name.trim() !== ''
  );

  for (const product of validProducts) {
    if (product.variants?.length) {
      for (const variant of product.variants) {
        const feedItem = buildVariantFeedItem({
          product,
          variant,
          merchant,
          baseUrl,
          currency,
          merchantUrl,
        });

        if (feedItem) {
          feedItems.push(stringifyFeedItem(feedItem));
        }
      }

      continue;
    }

    const feedItem = buildSimpleFeedItem({
      product,
      merchant,
      baseUrl,
      currency,
      merchantUrl,
    });

    if (feedItem) {
      feedItems.push(stringifyFeedItem(feedItem));
    }
  }

  return feedItems;
}
