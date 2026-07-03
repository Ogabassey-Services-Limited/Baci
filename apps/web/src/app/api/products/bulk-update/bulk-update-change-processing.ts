import type { SupabaseClient } from '@supabase/supabase-js';
import type { z } from 'zod';
import { generateProductSlug, generateSlug } from '@/lib/seo-utils';
import {
  resolveProductPurgeCategorySegment,
  resolveProductPurgeCategorySegmentForRow,
  type StorefrontProductPurgeEntry,
} from '@/lib/storefront-product-purge-urls';
import type { BulkUpdateChangesSchema } from '@/schemas/dashboard-product-import-actions';

type BulkUpdateChange = z.infer<
  typeof BulkUpdateChangesSchema
>['changes'][number];

type ProductChangeResult = {
  updated: number;
  created: number;
  removed: number;
  errors: string[];
};

const BULK_PURGE_ROW_COLUMNS =
  'id, slug, category, categories:category_id(slug), product_categories(categories(slug))';

interface BulkPurgeProductRow {
  id: string;
  slug: string | null;
  category: string | null;
  categories?: unknown;
  product_categories?: unknown;
}

function purgeEntriesFromRows(
  rows: BulkPurgeProductRow[] | null | undefined
): StorefrontProductPurgeEntry[] {
  return (rows ?? []).flatMap((row) => {
    const slug = row.slug?.trim() || row.id;
    return slug
      ? [{
          slug,
          categorySegment: resolveProductPurgeCategorySegmentForRow({
            slug,
            category: row.category,
            categories: row.categories,
            product_categories: row.product_categories,
          }),
        }]
      : [];
  });
}

const emptyProductChangeResult = (): ProductChangeResult => ({
  updated: 0,
  created: 0,
  removed: 0,
  errors: [],
});

function getChangeGroupKey(change: BulkUpdateChange): string | null {
  const productId = change.productId?.trim();
  if (productId) return `id:${productId}`;

  const sku = change.details.sku?.trim();
  if (sku) return `sku:${sku}`;

  const name = change.details.name?.trim();
  if (name) return `name:${name}`;

  return null;
}

function groupChangesByProduct(
  changes: BulkUpdateChange[]
): BulkUpdateChange[][] {
  const groups: BulkUpdateChange[][] = [];
  const groupByKey = new Map<string, BulkUpdateChange[]>();

  for (const change of changes) {
    const key = getChangeGroupKey(change);
    if (!key) {
      groups.push([change]);
      continue;
    }

    const existingGroup = groupByKey.get(key);
    if (existingGroup) {
      existingGroup.push(change);
      continue;
    }

    const group = [change];
    groupByKey.set(key, group);
    groups.push(group);
  }

  return groups;
}

function summarizeChangeFailure(
  change: BulkUpdateChange,
  err: unknown
): string {
  const safeName = String(change.details?.name || 'unknown')
    .replace(/[\r\n]/g, '')
    .substring(0, 100);
  const safeType = String(change.type || 'unknown').replace(/[\r\n]/g, '');
  console.error('Error processing change for:', safeName, err);
  return `Failed to ${safeType} "${safeName}"`;
}

async function processBulkUpdateChange({
  change,
  currency,
  merchantBusinessName,
  merchantId,
  onPurgeEntries,
  supabase,
}: {
  change: BulkUpdateChange;
  currency: string;
  merchantBusinessName: string;
  merchantId: string;
  onPurgeEntries?: (entries: StorefrontProductPurgeEntry[]) => void;
  supabase: SupabaseClient;
}): Promise<ProductChangeResult> {
  const result = emptyProductChangeResult();

  try {
    if (change.type === 'update') {
      const productId = change.productId?.trim();
      const sku = change.details.sku?.trim();
      const name = change.details.name?.trim() ?? '';

      if (!productId && !sku && !name) {
        result.errors.push(
          'Skipped update without a product id, SKU, or product name.'
        );
        return result;
      }

      const updates: Record<string, unknown> = {
        price: change.newPrice ?? change.details.price,
        category: change.details.category,
      };
      if (name) updates.name = name;
      if (typeof change.details.cost_price === 'number') {
        updates.cost_price = change.details.cost_price;
      } else if (
        change.details.cost_price === null &&
        change.details.cost_price_was_edited === true
      ) {
        updates.cost_price = null;
      }

      let matchQuery = supabase.from('products').update(updates);
      if (productId) {
        matchQuery = matchQuery
          .eq('id', productId)
          .eq('merchant_id', merchantId);
      } else if (sku) {
        matchQuery = matchQuery.eq('sku', sku).eq('merchant_id', merchantId);
      } else {
        matchQuery = matchQuery.eq('name', name).eq('merchant_id', merchantId);
      }

      const { data: updatedRows, error } = await matchQuery.select(
        BULK_PURGE_ROW_COLUMNS
      );
      if (error) throw error;
      onPurgeEntries?.(purgeEntriesFromRows(updatedRows as BulkPurgeProductRow[]));
      result.updated = 1;
      return result;
    }

    if (change.type === 'new') {
      const slug = generateProductSlug(change.details.name, 'new', undefined);
      const sku =
        change.details.sku ||
        generateSlug(change.details.name).toUpperCase().substring(0, 20);

      const { data: insertedRow, error } = await supabase
        .from('products')
        .insert({
        merchant_id: merchantId,
        name: change.details.name,
        description: change.details.description || '',
        price: change.details.price,
        cost_price: change.details.cost_price,
        stock_quantity: change.details.stock || 0,
        sku,
        slug,
        status: 'draft',
        condition: 'new',
        manage_stock: true,
        brand: change.details.brand || merchantBusinessName,
        category: change.details.category || 'General',
        taxable: true,
        schema_markup: {
          '@context': 'https://schema.org/',
          '@type': 'Product',
          name: change.details.name,
          sku,
          brand: {
            '@type': 'Brand',
            name: change.details.brand || merchantBusinessName,
          },
          offers: {
            '@type': 'Offer',
            priceCurrency: currency,
            price: change.details.price,
            availability: 'https://schema.org/InStock',
          },
        },
        })
        .select('id')
        .maybeSingle();

      if (error) throw error;
      const createdPurgeSlug = slug?.trim() || insertedRow?.id;
      if (createdPurgeSlug) {
        onPurgeEntries?.([
          {
            slug: createdPurgeSlug,
            categorySegment: resolveProductPurgeCategorySegment({
              slug: createdPurgeSlug,
              name: change.details.name,
              category: change.details.category || 'General',
            }),
          },
        ]);
      }
      result.created = 1;
      return result;
    }

    if (change.type === 'remove' && change.productId) {
      const { data: archivedRows, error } = await supabase
        .from('products')
        .update({ status: 'archived' })
        .eq('id', change.productId)
        .eq('merchant_id', merchantId)
        .select(BULK_PURGE_ROW_COLUMNS);
      if (error) throw error;
      onPurgeEntries?.(purgeEntriesFromRows(archivedRows as BulkPurgeProductRow[]));
      result.removed = 1;
    }
  } catch (err) {
    result.errors.push(summarizeChangeFailure(change, err));
  }

  return result;
}

async function processChangeGroup(
  args: Omit<Parameters<typeof processBulkUpdateChange>[0], 'change'> & {
    group: BulkUpdateChange[];
  }
): Promise<ProductChangeResult> {
  const summary = emptyProductChangeResult();

  for (const change of args.group) {
    const result = await processBulkUpdateChange({ ...args, change });
    summary.updated += result.updated;
    summary.created += result.created;
    summary.removed += result.removed;
    summary.errors.push(...result.errors);
  }

  return summary;
}

export async function processBulkUpdateChanges({
  changes,
  currency,
  merchantBusinessName,
  merchantId,
  onPurgeEntries,
  supabase,
}: {
  changes: BulkUpdateChange[];
  currency: string;
  merchantBusinessName: string;
  merchantId: string;
  onPurgeEntries?: (entries: StorefrontProductPurgeEntry[]) => void;
  supabase: SupabaseClient;
}): Promise<ProductChangeResult> {
  const summary = emptyProductChangeResult();
  const groupedChanges = groupChangesByProduct(changes);

  const groupResults: ProductChangeResult[] = [];
  for (let offset = 0; offset < groupedChanges.length; offset += 10) {
    const batchResults = await Promise.all(
      groupedChanges.slice(offset, offset + 10).map((group) =>
        processChangeGroup({
          group,
          currency,
          merchantBusinessName,
          merchantId,
          onPurgeEntries,
          supabase,
        })
      )
    );
    groupResults.push(...batchResults);
  }

  for (const groupResult of groupResults) {
    summary.updated += groupResult.updated;
    summary.created += groupResult.created;
    summary.removed += groupResult.removed;
    summary.errors.push(...groupResult.errors);
  }

  return summary;
}
