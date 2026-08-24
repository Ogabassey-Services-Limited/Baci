import type { SupabaseClient } from '@supabase/supabase-js';
import { cacheLife, cacheTag } from 'next/cache';
import type { CachedCategoryPageProductScope } from '@/lib/category-page-product-id-cache';
import { getPublicSupabaseClient } from '@/lib/public-supabase-client';
import { STOREFRONT_SPECIAL_COLLECTION_SLUGS } from '@/lib/storefront-special-collection-slugs';
import type { StorefrontDatabase } from '@/types/storefront-database';

export interface CompareCategoryShell {
  fallbackName: string;
  isCollection: boolean;
  productScope: CachedCategoryPageProductScope;
}

interface CategoryRow {
  id: string;
  is_active: boolean | null;
  name: string | null;
}

interface CategorySlugState {
  is_active: boolean | null;
}

function isSpecialCollectionSlug(categorySlug: string): boolean {
  return STOREFRONT_SPECIAL_COLLECTION_SLUGS.includes(
    categorySlug as (typeof STOREFRONT_SPECIAL_COLLECTION_SLUGS)[number]
  );
}

function getSpecialCollectionName(categorySlug: string): string {
  switch (categorySlug) {
    case 'new-arrivals':
      return 'New Arrivals';
    case 'best-sellers':
      return 'Best Sellers';
    case 'on-sale':
      return 'On Sale';
    case 'featured':
      return 'Featured';
    default:
      return getCategoryFallbackName(categorySlug);
  }
}

function getCategoryFallbackName(categorySlug: string): string {
  let decodedSlug = categorySlug;
  try {
    decodedSlug = decodeURIComponent(categorySlug);
  } catch {
    // Keep fallback naming total for malformed inputs from internal callers.
  }

  return decodedSlug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export async function getCachedCompareCategoryShell(
  merchantId: string,
  categorySlug: string,
  _storeSlug: string
): Promise<CompareCategoryShell> {
  'use cache';
  cacheLife('storefront-page');
  cacheTag(
    'category-page-data',
    'products',
    'categories',
    `products-${merchantId}`,
    `categories-${merchantId}`
  );

  if (isSpecialCollectionSlug(categorySlug)) {
    return {
      fallbackName: getSpecialCollectionName(categorySlug),
      isCollection: true,
      productScope: {
        kind: 'collection',
        collectionSlug:
          categorySlug as (typeof STOREFRONT_SPECIAL_COLLECTION_SLUGS)[number],
      },
    };
  }

  const supabase =
    getPublicSupabaseClient() as unknown as SupabaseClient<StorefrontDatabase>;
  const categoryQuery = supabase
    .from('categories')
    .select('id, name, is_active')
    .eq('merchant_id', merchantId)
    .eq('slug', categorySlug)
    .single() as unknown as Promise<{
    data: CategoryRow | null;
    error: unknown;
  }>;
  const { data: categoryRow, error: categoryError } = await categoryQuery;

  const noRows =
    categoryError &&
    typeof categoryError === 'object' &&
    categoryError !== null &&
    Reflect.get(categoryError, 'code') === 'PGRST116';
  if (categoryError && !noRows) throw categoryError;

  let hiddenCategoryState: CategorySlugState | null = null;
  if (!categoryRow) {
    const { data, error } = await supabase.rpc(
      'get_storefront_category_slug_state',
      { p_merchant_id: merchantId, p_slug: categorySlug }
    );
    if (error) throw error;
    const states = data as CategorySlugState[] | null;
    hiddenCategoryState = states?.[0] ?? null;
  }

  const isInactiveCategory =
    categoryRow?.is_active === false ||
    hiddenCategoryState?.is_active === false;
  const fallbackName =
    categoryRow?.name || getCategoryFallbackName(categorySlug);

  if (isInactiveCategory) {
    return {
      fallbackName,
      isCollection: false,
      productScope: { kind: 'none' },
    };
  }

  if (!categoryRow?.id) {
    return {
      fallbackName,
      isCollection: false,
      productScope: { kind: 'legacy', categoryName: fallbackName },
    };
  }

  const { data: categoryScope, error: categoryScopeError } = await supabase
    .from('categories')
    .select('id')
    .eq('merchant_id', merchantId)
    .eq('is_active', true)
    .or(`id.eq.${categoryRow.id},parent_id.eq.${categoryRow.id}`);
  if (categoryScopeError) throw categoryScopeError;

  const categoryIds = Array.from(
    new Set(
      [
        categoryRow.id,
        ...((categoryScope || []) as Array<{ id?: string | null }>).map(
          (item) => item.id
        ),
      ].filter((id): id is string => typeof id === 'string' && id.length > 0)
    )
  );

  return {
    fallbackName,
    isCollection: false,
    productScope: {
      kind: 'category',
      categoryId: categoryRow.id,
      categoryIds,
    },
  };
}
