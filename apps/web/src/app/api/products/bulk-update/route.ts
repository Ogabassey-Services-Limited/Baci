import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-auth';
import { revalidateProducts } from '@/lib/cache-revalidation';
import { checkCsrfProtection } from '@/lib/csrf';
import { getCurrencyConfig } from '@/lib/currency';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { generateProductSlug, generateSlug } from '@/lib/seo-utils';
import { scheduleStorefrontProductPurge } from '@/lib/storefront-product-purge';
import {
  resolveProductPurgeCategorySegment,
  resolveProductPurgeCategorySegmentForRow,
  type StorefrontProductPurgeEntry,
} from '@/lib/storefront-purge-urls';
import { createClient } from '@/lib/supabase/server';
import { BulkUpdateChangesSchema } from '@/schemas/dashboard-product-import-actions';

// Above this many affected products in a single bulk op, purge only the shared
// listing surfaces (home, /products, and each distinct /<category>) and skip
// the per-PDP URLs. This bounds the outbound fan-out against Cloudflare's
// per-request URL budget (30 URLs/batch); the short-TTL PDPs self-heal, and the
// listings every product shares are still evicted.
const BULK_PURGE_LISTINGS_ONLY_THRESHOLD = 50;

// The columns a bulk-affected product row must return so its canonical PDP
// purge URL can be derived (id is the slug fallback for legacy null-slug rows;
// the direct join + junction resolve the same canonical the storefront serves).
const BULK_PURGE_ROW_COLUMNS =
  'id, slug, category, categories:category_id(slug), product_categories(categories(slug))';

interface BulkPurgeProductRow {
  id: string;
  slug: string | null;
  category: string | null;
  categories?: unknown;
  product_categories?: unknown;
}

function collectPurgeEntriesFromRows(
  rows: BulkPurgeProductRow[] | null | undefined,
  into: StorefrontProductPurgeEntry[]
): void {
  for (const row of rows ?? []) {
    // Legacy rows can have a null/blank slug but stay addressable by id
    // (`/products/<id>`), so fall back to the id for the purge target.
    const slug = row.slug?.trim() || row.id;
    if (!slug) {
      continue;
    }
    into.push({
      slug,
      categorySegment: resolveProductPurgeCategorySegmentForRow({
        slug,
        category: row.category,
        categories: row.categories,
        product_categories: row.product_categories,
      }),
    });
  }
}

export async function POST(request: NextRequest) {
  const { valid, response } = await checkCsrfProtection(request);
  if (!valid && response) return response;

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'products', 'edit')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }
    const merchantId = merchantContext.merchantId;

    // Fetch business_name and currency fields for product creation
    const { data: merchantDetails, error: merchantError } = await supabase
      .from('merchants')
      .select('business_name, country, payout_currency')
      .eq('id', merchantId)
      .maybeSingle();

    if (merchantError) {
      return NextResponse.json(
        { error: 'Failed to fetch merchant details' },
        { status: 500 }
      );
    }

    const merchantBusinessName =
      merchantDetails?.business_name ?? merchantContext.businessName ?? '';
    const merchantCountry = merchantDetails?.country ?? null;
    const merchantPayoutCurrency = merchantDetails?.payout_currency ?? null;
    const currency = getCurrencyConfig(
      merchantCountry,
      merchantPayoutCurrency
    ).code;

    const body = await request.json();

    const parseResult = BulkUpdateChangesSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid changes data',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const changes = parseResult.data.changes;

    const results = {
      updated: 0,
      created: 0,
      removed: 0,
      errors: [] as string[],
    };

    // Product purge targets accumulated across the whole batch so the raised
    // storefront edge TTL never serves a stale listing/PDP after a bulk edit.
    const purgeEntries: StorefrontProductPurgeEntry[] = [];

    for (const change of changes) {
      try {
        if (change.type === 'update') {
          const productId = change.productId?.trim();
          const sku = change.details.sku?.trim();
          const name = change.details.name?.trim() ?? '';

          if (!productId && !sku && !name) {
            results.errors.push(
              'Skipped update without a product id, SKU, or product name.'
            );
            continue;
          }

          const updates: Record<string, unknown> = {
            price: change.newPrice ?? change.details.price,
            category: change.details.category,
          };
          if (name) {
            updates.name = name;
          }
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
            matchQuery = matchQuery
              .eq('sku', sku)
              .eq('merchant_id', merchantId);
          } else {
            // Fallback: match by name and merchant_id for name-only sheets.
            matchQuery = matchQuery
              .eq('name', name)
              .eq('merchant_id', merchantId);
          }

          // Return the affected rows (slug + category joins) in the SAME query
          // so the Cloudflare purge covers every updated PDP/listing without an
          // extra round trip.
          const { data: updatedRows, error } = await matchQuery.select(
            BULK_PURGE_ROW_COLUMNS
          );
          if (error) throw error;
          collectPurgeEntriesFromRows(
            updatedRows as BulkPurgeProductRow[] | null,
            purgeEntries
          );
          results.updated++;
        } else if (change.type === 'new') {
          const slug = generateProductSlug(
            change.details.name,
            'new',
            undefined
          );
          const sku =
            change.details.sku ||
            generateSlug(change.details.name).toUpperCase().substring(0, 20);

          // Basic product insert
          const { error } = await supabase.from('products').insert({
            merchant_id: merchantId,
            name: change.details.name,
            description: change.details.description || '',
            price: change.details.price,
            cost_price: change.details.cost_price,
            stock_quantity: change.details.stock || 0,
            sku: sku,
            slug: slug,
            status: 'draft', // Always draft for new imports
            condition: 'new',
            manage_stock: true,
            brand: change.details.brand || merchantBusinessName,

            category: change.details.category || 'General',
            taxable: true,
            // Minimal defaults
            schema_markup: {
              '@context': 'https://schema.org/',
              '@type': 'Product',
              name: change.details.name,
              sku: sku,
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
          });

          if (error) throw error;
          // A freshly inserted product has no `category_id`/junction yet, so its
          // canonical segment derives from the legacy text (or the /products
          // fallback). The generated slug is always present here.
          purgeEntries.push({
            slug,
            categorySegment: resolveProductPurgeCategorySegment({
              slug,
              name: change.details.name,
              // Mirror the inserted `category` (defaults to 'General') so the
              // purge targets the same listing the new product is filed under.
              category: change.details.category || 'General',
            }),
          });
          results.created++;
        } else if (change.type === 'remove') {
          // Remove Logic (Archive)
          if (change.productId) {
            const { data: archivedRows, error } = await supabase
              .from('products')
              .update({ status: 'archived' })
              .eq('id', change.productId)
              .eq('merchant_id', merchantId)
              .select(BULK_PURGE_ROW_COLUMNS);
            if (error) throw error;
            collectPurgeEntriesFromRows(
              archivedRows as BulkPurgeProductRow[] | null,
              purgeEntries
            );
            results.removed++;
          }
        }
      } catch (err) {
        // Sanitize user-controlled values before logging to prevent log injection
        const safeName = String(change.details?.name || 'unknown')
          .replace(/[\r\n]/g, '')
          .substring(0, 100);
        const safeType = String(change.type || 'unknown').replace(
          /[\r\n]/g,
          ''
        );
        console.error('Error processing change for:', safeName, err);
        results.errors.push(`Failed to ${safeType} "${safeName}"`);
      }
    }

    // Invalidate product caches after bulk update
    revalidateProducts(merchantId);

    // Evict the Cloudflare-fronted public URLs the batch changed so the raised
    // edge TTL never serves stale listings/PDPs. Fire-and-forget: a purge is
    // always survivable (caches self-heal on their TTL), so it must never break
    // the bulk update. Past the threshold, purge only the shared listing
    // surfaces to bound the outbound fan-out (see the threshold's docs).
    try {
      scheduleStorefrontProductPurge(
        merchantContext.merchantSlug,
        purgeEntries,
        {
          listingsOnly:
            purgeEntries.length > BULK_PURGE_LISTINGS_ONLY_THRESHOLD,
        }
      );
    } catch (purgeError) {
      console.warn('Skipped Cloudflare product purge after bulk update', {
        purgeError,
      });
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Bulk update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
