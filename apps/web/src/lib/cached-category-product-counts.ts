import { cacheLife, cacheTag } from 'next/cache';
import { getPublicSupabaseClient } from '@/lib/cached-data';

interface CachedCategoryProductCountCategory {
  id: string;
  is_active?: boolean | null;
  parent_id?: string | null;
}

function normalizeProductCategoryRows(
  productCategories:
    | Array<{ category_id?: string | null }>
    | { category_id?: string | null }
    | null
    | undefined
) {
  if (Array.isArray(productCategories)) {
    return productCategories;
  }

  return productCategories ? [productCategories] : [];
}

function buildChildrenByParentId(
  categories: CachedCategoryProductCountCategory[]
) {
  const childrenByParentId = new Map<
    string,
    CachedCategoryProductCountCategory[]
  >();

  for (const category of categories) {
    if (!category.parent_id) {
      continue;
    }

    const siblings = childrenByParentId.get(category.parent_id) ?? [];
    siblings.push(category);
    childrenByParentId.set(category.parent_id, siblings);
  }

  return childrenByParentId;
}

/**
 * Cached active product counts for category pagination modules.
 * Counts include active child categories so links mirror category page scope.
 */
export async function getCachedCategoryProductCounts(
  merchantId: string,
  categories: CachedCategoryProductCountCategory[]
): Promise<Record<string, number>> {
  'use cache: remote';
  cacheLife('categories');
  cacheTag('categories', `categories-${merchantId}`, 'products');

  const activeCategories = categories.filter(
    (category) => category.is_active !== false
  );

  if (activeCategories.length === 0) {
    return {};
  }

  const childrenByParentId = buildChildrenByParentId(activeCategories);
  const scopeIdsByCategoryId = new Map<string, Set<string>>();
  const ownerCategoryIdsByScopedId = new Map<string, Set<string>>();

  for (const category of activeCategories) {
    const scopeIds = new Set<string>([category.id]);

    for (const childCategory of childrenByParentId.get(category.id) ?? []) {
      scopeIds.add(childCategory.id);
    }

    scopeIdsByCategoryId.set(category.id, scopeIds);

    for (const scopeId of scopeIds) {
      const ownerCategoryIds =
        ownerCategoryIdsByScopedId.get(scopeId) ?? new Set<string>();
      ownerCategoryIds.add(category.id);
      ownerCategoryIdsByScopedId.set(scopeId, ownerCategoryIds);
    }
  }

  if (ownerCategoryIdsByScopedId.size === 0) {
    return {};
  }

  const supabase = getPublicSupabaseClient();
  const { data, error } = await supabase
    .from('products')
    .select('id, product_categories!inner(category_id)')
    .eq('merchant_id', merchantId)
    .eq('status', 'active')
    .in('product_categories.category_id', [
      ...ownerCategoryIdsByScopedId.keys(),
    ]);

  if (error) {
    console.error('Error fetching category product counts:', error);
    return {};
  }

  const productIdsByCategoryId = new Map<string, Set<string>>();

  for (const categoryId of scopeIdsByCategoryId.keys()) {
    productIdsByCategoryId.set(categoryId, new Set<string>());
  }

  for (const product of (data || []) as Array<{
    id?: string | null;
    product_categories?:
      | Array<{ category_id?: string | null }>
      | { category_id?: string | null }
      | null;
  }>) {
    if (!product.id) {
      continue;
    }

    for (const productCategory of normalizeProductCategoryRows(
      product.product_categories
    )) {
      const categoryId = productCategory.category_id;
      if (!categoryId) {
        continue;
      }

      for (const ownerCategoryId of ownerCategoryIdsByScopedId.get(
        categoryId
      ) ?? []) {
        productIdsByCategoryId.get(ownerCategoryId)?.add(product.id);
      }
    }
  }

  return Object.fromEntries(
    [...productIdsByCategoryId.entries()].map(([categoryId, productIds]) => [
      categoryId,
      productIds.size,
    ])
  );
}
