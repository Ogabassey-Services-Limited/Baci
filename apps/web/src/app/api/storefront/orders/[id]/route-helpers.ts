import { formatCanonicalProductConditionLabel } from '@baci/shared/lib';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sanitizeForLog } from '@/lib/sanitize-core';

export interface OrderItem {
  id: string;
  product_id: string;
  condition?: string | null;
  image_url?: string | null;
  variant_name?: string | null;
  product_name?: string;
  name?: string;
  quantity: number;
  price: number;
  product_images?: string[];
  gtin?: string | null;
  product_slug?: string;
  category?: string;
  category_slug?: string;
  categories?: { name?: string; slug?: string } | null;
  products?:
    | {
        slug?: string;
        gtin?: string | null;
        category?: string;
        category_slug?: string;
        categories?:
          | { name?: string; slug?: string }[]
          | { name?: string; slug?: string }
          | null;
      }
    | {
        slug?: string;
        gtin?: string | null;
        category?: string;
        category_slug?: string;
        categories?:
          | { name?: string; slug?: string }[]
          | { name?: string; slug?: string }
          | null;
      }[]
    | null;
}

function extractJoinedProduct(products: OrderItem['products']): {
  slug?: string;
  gtin?: string | null;
  category?: string;
  category_slug?: string;
  categories?:
    | { name?: string; slug?: string }[]
    | { name?: string; slug?: string }
    | null;
} | null {
  return Array.isArray(products) ? products[0] || null : products || null;
}

function flattenOrderItemProductData(item: OrderItem) {
  const product = extractJoinedProduct(item.products);
  const categories = Array.isArray(product?.categories)
    ? product?.categories[0] || null
    : product?.categories || item.categories || null;

  return {
    product_slug: product?.slug || item.product_slug,
    gtin: product?.gtin || item.gtin || null,
    category: product?.category || item.category,
    category_slug: categories?.slug || item.category_slug,
    categories,
  };
}

function getOrderItemVariantName(item: OrderItem) {
  return (
    item.variant_name ||
    formatCanonicalProductConditionLabel(item.condition) ||
    undefined
  );
}

export async function fetchProductRouteDetails(
  items: OrderItem[],
  loadProducts: (productIds: string[]) => Promise<{
    data: Array<{
      id: string;
      slug: string | null;
      gtin: string | null;
      category: string | null;
      categories?:
        | { name?: string; slug?: string }[]
        | { name?: string; slug?: string }
        | null;
    }> | null;
    error: { message?: string } | null;
  }>
) {
  const productIds = Array.from(
    new Set(
      items
        .map((item) => item.product_id)
        .filter((value): value is string => Boolean(value))
    )
  );

  if (productIds.length === 0) {
    return new Map<string, ReturnType<typeof flattenOrderItemProductData>>();
  }

  const { data, error } = await loadProducts(productIds);

  if (error || !data) {
    console.warn(
      'Failed to fetch product route details for order items',
      error
    );
    return new Map<string, ReturnType<typeof flattenOrderItemProductData>>();
  }

  return new Map(
    data.map((product) => [
      product.id,
      {
        product_slug: product.slug,
        gtin: product.gtin,
        category: product.category,
        category_slug: Array.isArray(product.categories)
          ? product.categories[0]?.slug || null
          : product.categories?.slug || null,
        categories: Array.isArray(product.categories)
          ? product.categories[0] || null
          : product.categories || null,
      },
    ])
  );
}

export async function resolveMerchantIdBySlug(
  merchantSlug: string,
  supabase: Pick<SupabaseClient, 'from'>
) {
  const { data: merchant, error } = await supabase
    .from('merchants')
    .select('id')
    .eq('slug', merchantSlug)
    .single();

  if (error || !merchant) {
    console.debug('[API/Orders] Failed to resolve merchant slug', {
      merchantSlug: sanitizeForLog(merchantSlug),
      error: error?.message ? sanitizeForLog(error.message) : null,
    });
    return null;
  }

  return merchant.id;
}

export function mapOrderItemsWithRoutes(
  items: OrderItem[],
  productRouteDetails?: Map<
    string,
    {
      product_slug?: string | null;
      gtin?: string | null;
      category?: string | null;
      category_slug?: string | null;
      categories?: { name?: string; slug?: string } | null;
    }
  >
) {
  return items.map((item: OrderItem) => {
    const displayName = item.product_name || item.name || '';
    return {
      id: item.id,
      product_id: item.product_id,
      product_name: displayName,
      name: displayName,
      quantity: item.quantity,
      price: item.price,
      condition: item.condition || null,
      image_url: item.image_url,
      variant_name: getOrderItemVariantName(item) || null,
      product_images: item.product_images,
      ...flattenOrderItemProductData(item),
      ...(productRouteDetails?.get(item.product_id) || {}),
    };
  });
}
