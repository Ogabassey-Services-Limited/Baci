import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hasPermission } from '@/lib/api-auth';
import { revalidateProducts } from '@/lib/cache-revalidation';
import { getCountryByCode } from '@/lib/countries';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { generateProductSlug, generateSlug } from '@/lib/seo-utils';
import { createClient } from '@/lib/supabase/server';
import { ChangeSchema } from '@/schemas/dashboard-product-import-actions';

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

    // Fetch business_name and country for product creation
    const { data: merchantDetails } = await supabase
      .from('merchants')
      .select('business_name, country')
      .eq('id', merchantId)
      .single();
    const merchantBusinessName =
      merchantDetails?.business_name ?? merchantContext.businessName ?? '';
    const merchantCountry = merchantDetails?.country ?? null;

    const body = await request.json();

    const parseResult = z
      .object({ changes: z.array(ChangeSchema) })
      .safeParse(body);
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

    for (const change of changes) {
      try {
        if (change.type === 'update') {
          // Update Logic
          // Prefer productId, fallback to SKU if available (though productId should be present for updates)
          let matchQuery = supabase.from('products').update({
            price: change.newPrice ?? change.details.price,
            category: change.details.category,
            // Only update other fields if they are explicitly different/provided?
            // For now, let's assume the AI only suggests price updates mostly.
            // But if we want to sync names:
            name: change.details.name,
          });

          if (change.productId) {
            matchQuery = matchQuery
              .eq('id', change.productId)
              .eq('merchant_id', merchantId);
          } else if (change.details.sku) {
            matchQuery = matchQuery
              .eq('sku', change.details.sku)
              .eq('merchant_id', merchantId);
          } else {
            // Fallback: match by name and merchant_id (risky but necessary for name-only sheets)
            matchQuery = matchQuery
              .eq('name', change.details.name)
              .eq('merchant_id', merchantId);
          }

          const { error } = await matchQuery;
          if (error) throw error;
          results.updated++;
        } else if (change.type === 'new') {
          // Create Logic
          const slug = generateProductSlug(
            change.details.name,
            'new',
            undefined
          );
          const sku =
            change.details.sku ||
            generateSlug(change.details.name).toUpperCase().substring(0, 20);

          const country = merchantCountry
            ? getCountryByCode(merchantCountry)
            : undefined;
          const currency = country ? country.currency : 'USD';

          // Basic product insert
          const { error } = await supabase.from('products').insert({
            merchant_id: merchantId,
            name: change.details.name,
            description: change.details.description || '',
            price: change.details.price,
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
          results.created++;
        } else if (change.type === 'remove') {
          // Remove Logic (Archive)
          if (change.productId) {
            const { error } = await supabase
              .from('products')
              .update({ status: 'archived' })
              .eq('id', change.productId)
              .eq('merchant_id', merchantId);
            if (error) throw error;
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

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Bulk update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
