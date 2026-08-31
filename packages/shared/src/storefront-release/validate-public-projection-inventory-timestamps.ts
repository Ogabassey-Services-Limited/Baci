import type { RefinementCtx } from 'zod';

interface SeoCategory {
  id: string;
  parentId?: string | null;
  slug: string;
  status?: string;
}

interface SeoProduct {
  available: boolean;
  brand?: string | null;
  categoryIds?: readonly string[];
  createdAt?: string;
  primaryCategoryId?: string | null;
  updatedAt?: string;
}

const COMPARE_INVENTORY_LIMIT = 600;
const BRAND_AUTHORITY_LIMIT = 48;
const BRAND_ALIASES = [
  ['samsung'],
  ['google'],
  ['infinix'],
  ['tecno'],
  ['itel'],
  ['xiaomi', 'redmi'],
  ['oppo'],
] as const;

function isValidTimestamp(value: string | undefined): boolean {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function productCategoryIds(product: SeoProduct): ReadonlySet<string> {
  return new Set([
    ...(product.categoryIds ?? []),
    ...(product.primaryCategoryId ? [product.primaryCategoryId] : []),
  ]);
}

function matchesBrand(
  product: SeoProduct,
  aliases: readonly string[]
): boolean {
  return (
    typeof product.brand === 'string' &&
    aliases.some((alias) => product.brand?.toLowerCase() === alias)
  );
}

function addMissingTimestampIssue(
  context: RefinementCtx,
  productIndex: number,
  field: 'createdAt' | 'updatedAt'
): void {
  context.addIssue({
    code: 'custom',
    message:
      field === 'createdAt'
        ? 'Created timestamps are required for truncated compare inventory'
        : 'Updated timestamps are required for truncated brand inventory',
    path: ['products', productIndex, field],
  });
}

function requireTimestampWindow(
  indexes: readonly number[],
  products: readonly SeoProduct[],
  field: 'createdAt' | 'updatedAt',
  limit: number,
  context: RefinementCtx,
  reported: Set<string>
): void {
  if (indexes.length <= limit) return;
  for (const productIndex of indexes) {
    const value = products[productIndex]?.[field];
    if (isValidTimestamp(value)) continue;
    const key = `${productIndex}:${field}`;
    if (!reported.has(key)) {
      reported.add(key);
      addMissingTimestampIssue(context, productIndex, field);
    }
    break;
  }
}

/** Requires ordering metadata whenever projection inventories are truncated. */
export function validatePublicProjectionInventoryTimestamps(
  categories: readonly SeoCategory[],
  products: readonly SeoProduct[],
  context: RefinementCtx
): void {
  const productsByCategory = new Map<string, number[]>();
  for (const [productIndex, product] of products.entries()) {
    for (const categoryId of productCategoryIds(product)) {
      const indexes = productsByCategory.get(categoryId) ?? [];
      indexes.push(productIndex);
      productsByCategory.set(categoryId, indexes);
    }
  }

  const activeChildrenByParent = new Map<string, string[]>();
  for (const category of categories) {
    if (
      category.parentId &&
      (category.status === undefined || category.status === 'active')
    ) {
      const children = activeChildrenByParent.get(category.parentId) ?? [];
      children.push(category.id);
      activeChildrenByParent.set(category.parentId, children);
    }
  }

  const reported = new Set<string>();
  for (const category of categories) {
    const exactIndexes = productsByCategory.get(category.id) ?? [];
    requireTimestampWindow(
      exactIndexes,
      products,
      'createdAt',
      COMPARE_INVENTORY_LIMIT,
      context,
      reported
    );

    const scopedIndexes = new Set(exactIndexes);
    for (const childId of activeChildrenByParent.get(category.id) ?? [])
      for (const productIndex of productsByCategory.get(childId) ?? [])
        scopedIndexes.add(productIndex);
    requireTimestampWindow(
      [...scopedIndexes],
      products,
      'createdAt',
      COMPARE_INVENTORY_LIMIT,
      context,
      reported
    );
  }

  for (const category of categories) {
    if (category.slug !== 'smartphones') continue;
    const categoryIndexes = productsByCategory.get(category.id) ?? [];
    for (const aliases of BRAND_ALIASES) {
      const brandIndexes = categoryIndexes.filter(
        (productIndex) =>
          products[productIndex]?.available === true &&
          matchesBrand(products[productIndex], aliases)
      );
      requireTimestampWindow(
        brandIndexes,
        products,
        'updatedAt',
        BRAND_AUTHORITY_LIMIT,
        context,
        reported
      );
    }
  }
}
