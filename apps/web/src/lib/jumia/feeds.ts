/**
 * Jumia Vendor Center API — Feeds submodule
 * Product create/update, stock, price, status, feed status
 */

import type { JumiaClient } from '@/lib/jumia/client';
import type { JumiaFeedDetailsResponse } from '@/schemas/jumia';
import {
  JumiaFeedCreateResponseSchema,
  JumiaFeedDetailsResponseSchema,
} from '@/schemas/jumia';

// ── Shared Helpers ──

/**
 * Trims and validates that a required string field is non-empty.
 * Returns the trimmed value or throws with a contextual error.
 */
function validateRequiredString(
  value: string,
  fieldName: string,
  context: string
): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${context}: each ${fieldName} must be a non-empty string`);
  }
  return trimmed;
}

/**
 * Validates that a numeric field is finite and positive (> 0).
 * Returns the value or throws with a contextual error.
 */
function validatePositiveNumber(
  value: number,
  fieldName: string,
  context: string
): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${context}: ${fieldName} must be a positive number`);
  }
  return value;
}

/**
 * Validates a product variation's numeric fields.
 * Throws if stock or globalPrice.value is negative.
 */
function validateVariation(
  variation: {
    globalPrice: { value: number; currency?: string };
    stock?: number;
  },
  index: number,
  context: string
): void {
  if (
    !Number.isFinite(variation.globalPrice.value) ||
    variation.globalPrice.value < 0
  ) {
    throw new Error(
      `${context}: variation[${index}].globalPrice.value must be >= 0`
    );
  }
  if (
    'currency' in variation.globalPrice &&
    !variation.globalPrice.currency?.trim()
  ) {
    throw new Error(
      `${context}: variation[${index}].globalPrice.currency must be a non-empty string`
    );
  }
  if (
    variation.stock != null &&
    (!Number.isFinite(variation.stock) ||
      !Number.isInteger(variation.stock) ||
      variation.stock < 0)
  ) {
    throw new Error(`${context}: variation[${index}].stock must be >= 0`);
  }
}

// ── Product Create ──

export async function createProduct(
  client: JumiaClient,
  shopId: string,
  products: Array<{
    name: { value: string };
    brand: { code: number; name: string };
    category: { code: number };
    description?: { value: string };
    images?: Array<{ url: string; primary?: boolean }>;
    variations?: Array<{
      sellerSku: string;
      globalPrice: { value: number; currency: string };
      stock?: number;
      attributes?: Array<{ id: string; value: string }>;
    }>;
  }>
): Promise<string> {
  const trimmedShopId = shopId.trim();
  if (!trimmedShopId) {
    throw new Error('shopId must be a non-empty string');
  }
  if (!products.length) {
    throw new Error('products must be a non-empty array');
  }
  const validatedProducts = products.map((product) => {
    // Always validate required product-level fields
    const trimmedName = validateRequiredString(
      product.name.value,
      'name.value',
      'createProduct'
    );
    const trimmedBrandName = validateRequiredString(
      product.brand.name,
      'brand.name',
      'createProduct'
    );
    validatePositiveNumber(product.brand.code, 'brand.code', 'createProduct');
    validatePositiveNumber(
      product.category.code,
      'category.code',
      'createProduct'
    );
    const base = {
      ...product,
      name: { value: trimmedName },
      brand: { ...product.brand, name: trimmedBrandName },
    };
    if (!product.variations?.length) return base;
    return {
      ...base,
      variations: product.variations.map((variation, i) => {
        validateVariation(variation, i, 'createProduct');
        return {
          ...variation,
          sellerSku: validateRequiredString(
            variation.sellerSku,
            'sellerSku',
            'createProduct'
          ),
          globalPrice: {
            ...variation.globalPrice,
            currency: variation.globalPrice.currency.trim(),
          },
        };
      }),
    };
  });
  const response = await client.request(
    'POST',
    '/feeds/products/create',
    JumiaFeedCreateResponseSchema,
    { shopId: trimmedShopId, products: validatedProducts }
  );
  return response.feedId;
}

// ── Product Update ──

export async function updateProduct(
  client: JumiaClient,
  shopId: string,
  products: Array<{
    id: string;
    name?: { value: string };
    brand?: { code: number; name: string };
    description?: { value: string };
    images?: Array<{ url: string; primary?: boolean }>;
  }>
): Promise<string> {
  const trimmedShopId = shopId.trim();
  if (!trimmedShopId) {
    throw new Error('shopId must be a non-empty string');
  }
  if (!products.length) {
    throw new Error('products must be a non-empty array');
  }
  const validatedProducts = products.map((product) => {
    const id = validateRequiredString(product.id, 'id', 'updateProduct');
    const name = product.name
      ? {
          value: validateRequiredString(
            product.name.value,
            'name.value',
            'updateProduct'
          ),
        }
      : undefined;
    const brand = product.brand
      ? {
          ...product.brand,
          name: validateRequiredString(
            product.brand.name,
            'brand.name',
            'updateProduct'
          ),
          code: validatePositiveNumber(
            product.brand.code,
            'brand.code',
            'updateProduct'
          ),
        }
      : undefined;
    return {
      ...product,
      id,
      ...(name && { name }),
      ...(brand && { brand }),
    };
  });
  const response = await client.request(
    'POST',
    '/feeds/products/update',
    JumiaFeedCreateResponseSchema,
    { shopId: trimmedShopId, products: validatedProducts }
  );
  return response.feedId;
}

// ── Stock Update ──

export async function updateStock(
  client: JumiaClient,
  updates: Array<{ sellerSku: string; id: string; stock: number }>
): Promise<string> {
  if (!updates.length) {
    throw new Error('updates must be a non-empty array');
  }
  const trimmedUpdates = updates.map((item) => {
    const sellerSku = validateRequiredString(
      item.sellerSku,
      'sellerSku',
      'updateStock'
    );
    const id = validateRequiredString(item.id, 'id', 'updateStock');
    if (
      !Number.isFinite(item.stock) ||
      !Number.isInteger(item.stock) ||
      item.stock < 0
    ) {
      throw new Error(
        `updateStock: stock must be >= 0 for sellerSku "${sellerSku}"`
      );
    }
    return { ...item, sellerSku, id };
  });
  const response = await client.request(
    'POST',
    '/feeds/products/stock',
    JumiaFeedCreateResponseSchema,
    { products: trimmedUpdates }
  );
  return response.feedId;
}

// ── Price Update ──

export async function updatePrice(
  client: JumiaClient,
  updates: Array<{
    sellerSku: string;
    id: string;
    price: {
      value: number;
      currency: string;
      salePrice?: {
        value: number | null;
        startAt: string | null;
        endAt: string | null;
      };
    };
    category?: { code: number };
    businessClients?: Array<{
      businessClientCode: string;
      price: {
        value: number;
        currency: string;
        salePrice?: {
          value: number | null;
          startAt: string | null;
          endAt: string | null;
        };
      };
    }>;
  }>
): Promise<string> {
  if (!updates.length) {
    throw new Error('updates must be a non-empty array');
  }
  const validatedUpdates = updates.map((item) => {
    const sellerSku = validateRequiredString(
      item.sellerSku,
      'sellerSku',
      'updatePrice'
    );
    const id = validateRequiredString(item.id, 'id', 'updatePrice');
    if (!Number.isFinite(item.price.value) || item.price.value < 0) {
      throw new Error(
        `updatePrice: price.value must be a number >= 0 for sellerSku "${sellerSku}"`
      );
    }
    if (!item.price.currency?.trim()) {
      throw new Error(
        `updatePrice: price.currency must be a non-empty string for sellerSku "${sellerSku}"`
      );
    }
    if (
      item.price.salePrice?.value != null &&
      (!Number.isFinite(item.price.salePrice.value) ||
        item.price.salePrice.value < 0)
    ) {
      throw new Error(
        `updatePrice: salePrice.value must be a number >= 0 for sellerSku "${sellerSku}"`
      );
    }
    // Validate salePrice date fields when present
    if (item.price.salePrice?.startAt != null) {
      if (Number.isNaN(Date.parse(item.price.salePrice.startAt))) {
        throw new Error(
          `updatePrice: salePrice.startAt must be a valid ISO date for sellerSku "${sellerSku}"`
        );
      }
    }
    if (item.price.salePrice?.endAt != null) {
      if (Number.isNaN(Date.parse(item.price.salePrice.endAt))) {
        throw new Error(
          `updatePrice: salePrice.endAt must be a valid ISO date for sellerSku "${sellerSku}"`
        );
      }
    }
    if (
      item.price.salePrice?.startAt != null &&
      item.price.salePrice?.endAt != null
    ) {
      if (
        new Date(item.price.salePrice.startAt) >
        new Date(item.price.salePrice.endAt)
      ) {
        throw new Error(
          `updatePrice: salePrice.startAt must be <= endAt for sellerSku "${sellerSku}"`
        );
      }
    }
    // Validate category.code when present
    if (item.category?.code != null) {
      if (!Number.isFinite(item.category.code) || item.category.code <= 0) {
        throw new Error(
          `updatePrice: category.code must be a positive number for sellerSku "${sellerSku}"`
        );
      }
    }
    return {
      ...item,
      sellerSku,
      id,
      price: { ...item.price, currency: item.price.currency.trim() },
    };
  });
  const response = await client.request(
    'POST',
    '/feeds/products/price',
    JumiaFeedCreateResponseSchema,
    { products: validatedUpdates }
  );
  return response.feedId;
}

// ── Status Update ──

export async function updateStatus(
  client: JumiaClient,
  updates: Array<{
    sellerSku: string;
    id: string;
    status: 'active' | 'inactive' | 'deleted';
    businessClients?: Array<{
      businessClientCode: string;
      status: 'active' | 'inactive' | 'deleted';
    }>;
  }>
): Promise<string> {
  if (!updates.length) {
    throw new Error('updates must be a non-empty array');
  }
  const validatedUpdates = updates.map((item) => {
    const sellerSku = validateRequiredString(
      item.sellerSku,
      'sellerSku',
      'updateStatus'
    );
    const id = validateRequiredString(item.id, 'id', 'updateStatus');
    return { ...item, sellerSku, id };
  });
  const response = await client.request(
    'POST',
    '/feeds/products/status',
    JumiaFeedCreateResponseSchema,
    { products: validatedUpdates }
  );
  return response.feedId;
}

// ── Feed Status ──

export async function getFeedStatus(
  client: JumiaClient,
  feedId: string
): Promise<JumiaFeedDetailsResponse> {
  const trimmedFeedId = feedId.trim();
  if (!trimmedFeedId) {
    throw new Error('feedId must be a non-empty string');
  }

  return await client.request(
    'GET',
    `/feeds/${encodeURIComponent(trimmedFeedId)}`,
    JumiaFeedDetailsResponseSchema
  );
}
