import { cacheLife, cacheTag } from 'next/cache';
import { getProductScopedCacheTag } from '@/lib/product-cache-tags';
import { createPublicClient } from '@/lib/supabase/public';

export interface StorefrontProductSlugRedirectTarget {
  id: string;
  name: string;
  slug: string;
  category?: string | null;
  categories?: {
    id: string;
    name: string;
    slug: string;
    parent_id?: string | null;
  } | null;
}

export interface StorefrontProductSlugResolutionResult {
  hasError: boolean;
  present: boolean;
  redirectTarget?: StorefrontProductSlugRedirectTarget;
}

interface SlugResolutionRpcRow {
  present?: unknown;
  redirect_product_id?: unknown;
  redirect_product_name?: unknown;
  redirect_product_slug?: unknown;
  redirect_category?: unknown;
  redirect_category_id?: unknown;
  redirect_category_name?: unknown;
  redirect_category_slug?: unknown;
  redirect_category_parent_id?: unknown;
}

const FAIL_OPEN: StorefrontProductSlugResolutionResult = {
  hasError: true,
  present: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstRpcRow(data: unknown): SlugResolutionRpcRow | null {
  if (!Array.isArray(data)) {
    return null;
  }

  const row = data[0];
  return isRecord(row) ? row : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

/**
 * Cached per-slug resolver for proxy PDP decisions. Uses an anon-callable,
 * SECURITY DEFINER RPC instead of a service-role client in the request path.
 */
export async function getCachedStorefrontProductSlugResolution(
  merchantId: string,
  productSlug: string
): Promise<StorefrontProductSlugResolutionResult> {
  'use cache: remote';
  const normalizedMerchantId = merchantId.trim();
  const normalizedSlug = productSlug.trim().toLowerCase();
  if (!normalizedMerchantId || !normalizedSlug) {
    return FAIL_OPEN;
  }

  cacheLife('products');
  cacheTag('products', `product-slug-set-${normalizedMerchantId}`);
  cacheTag(
    'product',
    getProductScopedCacheTag(
      'product-slug-resolution',
      normalizedMerchantId,
      normalizedSlug
    )
  );

  const supabase = createPublicClient({
    clientInfo: 'storefront-product-slug-resolution',
  });

  const { data, error } = await supabase.rpc(
    'get_merchant_product_slug_resolution',
    {
      p_merchant_id: normalizedMerchantId,
      p_product_slug: normalizedSlug,
    }
  );

  if (error) {
    console.error('Error fetching storefront product slug resolution:', error);
    return FAIL_OPEN;
  }

  const row = firstRpcRow(data);
  if (!row || typeof row.present !== 'boolean') {
    return FAIL_OPEN;
  }

  if (!row.present) {
    return { hasError: false, present: false };
  }

  const redirectProductId = readString(row.redirect_product_id);
  const redirectProductName = readString(row.redirect_product_name);
  const redirectProductSlug = readString(row.redirect_product_slug);
  if (!redirectProductId || !redirectProductName || !redirectProductSlug) {
    return { hasError: false, present: true };
  }

  const categoryId = readString(row.redirect_category_id);
  const categoryName = readString(row.redirect_category_name);
  const categorySlug = readString(row.redirect_category_slug);
  const categories =
    categoryId && categoryName && categorySlug
      ? {
          id: categoryId,
          name: categoryName,
          slug: categorySlug,
          parent_id: readString(row.redirect_category_parent_id),
        }
      : null;

  return {
    hasError: false,
    present: true,
    redirectTarget: {
      id: redirectProductId,
      name: redirectProductName,
      slug: redirectProductSlug,
      category: readString(row.redirect_category),
      categories,
    },
  };
}
