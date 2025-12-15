import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import type { Change } from '@/app/dashboard/products/actions';
import { getCountryByCode } from '@/lib/countries';
import { generateProductSlug, generateSlug } from '@/lib/seo-utils';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
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

    const { data: merchant } = await supabase
      .from('merchants')
      .select('id, business_name, country')
      .eq('user_id', user.id)
      .single();

    if (!merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const changes: Change[] = body.changes;

    if (!Array.isArray(changes)) {
      return NextResponse.json(
        { error: 'Invalid changes data' },
        { status: 400 }
      );
    }

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
            // Only update other fields if they are explicitly different/provided?
            // For now, let's assume the AI only suggests price updates mostly.
            // But if we want to sync names:
            name: change.details.name,
          });

          if (change.productId) {
            matchQuery = matchQuery.eq('id', change.productId);
          } else if (change.details.sku) {
            matchQuery = matchQuery
              .eq('sku', change.details.sku)
              .eq('merchant_id', merchant.id);
          } else {
            // Fallback: match by name and merchant_id (risky but necessary for name-only sheets)
            matchQuery = matchQuery
              .eq('name', change.details.name)
              .eq('merchant_id', merchant.id);
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

          const country = merchant.country
            ? getCountryByCode(merchant.country)
            : undefined;
          const currency = country ? country.currency : 'USD';

          // Basic product insert
          const { error } = await supabase.from('products').insert({
            merchant_id: merchant.id,
            name: change.details.name,
            description: change.details.description || '',
            price: change.details.price,
            stock_quantity: change.details.stock || 0,
            sku: sku,
            slug: slug,
            status: 'draft', // Always draft for new imports
            is_active: false,
            condition: 'new',
            manage_stock: true,
            brand: change.details.brand || merchant.business_name,
            taxable: true,
            // Minimal defaults
            schema_markup: {
              '@context': 'https://schema.org/',
              '@type': 'Product',
              name: change.details.name,
              sku: sku,
              brand: {
                '@type': 'Brand',
                name: change.details.brand || merchant.business_name,
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
              .update({ status: 'archived', is_active: false })
              .eq('id', change.productId);
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
        // nosemgrep: javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring
        console.error(`Error processing change for ${safeName}:`, err); // lgtm[js/tainted-format-string]
        results.errors.push(`Failed to ${safeType} "${safeName}"`); // lgtm[js/tainted-format-string]
      }
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
