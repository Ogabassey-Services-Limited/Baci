import {
  resolveProductPurgeCategorySegmentForRow,
  type StorefrontProductPurgeEntry,
} from '@/lib/storefront-product-purge-urls';

export const BULK_PURGE_ROW_COLUMNS =
  'id, slug, category, categories:category_id(slug), product_categories(categories(slug))';

export interface BulkPurgeProductRow {
  id: string;
  slug: string | null;
  category: string | null;
  categories?: unknown;
  product_categories?: unknown;
}

export function getBulkPurgeEntries(
  rows: BulkPurgeProductRow[] | null | undefined
): StorefrontProductPurgeEntry[] {
  return (rows ?? []).flatMap((row) => {
    const slug = row.slug?.trim() || row.id;
    if (!slug) return [];

    return [
      {
        slug,
        categorySegment: resolveProductPurgeCategorySegmentForRow({
          slug,
          category: row.category,
          categories: row.categories,
          product_categories: row.product_categories,
        }),
      },
    ];
  });
}
