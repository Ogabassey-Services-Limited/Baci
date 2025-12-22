import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// PERFORMANCE: Enable caching with revalidation instead of force-dynamic
export const revalidate = 3600; // Revalidate every hour

export async function GET(_request: Request) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://baci.app';

  try {
    // PERFORMANCE: Select only required fields and add limit to prevent OOM
    const { data: products, error } = await supabase
      .from('products')
      .select(
        `id, name, description, slug, sku, price, image, images,
         stock, manage_stock, condition, brand, gtin, mpn,
         google_product_category, weight_value, weight_unit,
         parent_product_id`
      )
      .eq('status', 'active')
      .limit(10000);

    if (error) {
      console.error('Error fetching products for feed:', error);
      return new NextResponse('Error generating feed', { status: 500 });
    }

    // PERFORMANCE: Use array.map().join() instead of += string concatenation (O(n) vs O(n²))
    const items = (products || [])
      .filter((product) => product.name && product.price)
      .map((product) => {
        const link = `${siteUrl}/products/${product.slug || product.id}`;
        const imageLink = product.image || '';
        const availability =
          product.manage_stock && product.stock <= 0
            ? 'out of stock'
            : 'in stock';
        const price = `${product.price} USD`;

        // Handle Additional Images
        // Exclude the main image and take up to 10 unique additional images
        const additionalImages = Array.isArray(product.images)
          ? product.images
              .filter((img: string) => img !== imageLink)
              .slice(0, 10)
              .map(
                (img: string) =>
                  `<g:additional_image_link>${img}</g:additional_image_link>`
              )
              .join('\n  ')
          : '';

        // Handle Variant Grouping
        const itemGroupId = product.parent_product_id
          ? `<g:item_group_id>${product.parent_product_id}</g:item_group_id>`
          : '';

        return `<item>
  <g:id>${product.sku || product.id}</g:id>
  <g:title><![CDATA[${product.name}]]></g:title>
  <g:description><![CDATA[${product.description || product.name}]]></g:description>
  <g:link>${link}</g:link>
  <g:image_link>${imageLink}</g:image_link>
  ${additionalImages}
  <g:condition>${product.condition || 'new'}</g:condition>
  <g:availability>${availability}</g:availability>
  <g:price>${price}</g:price>
  <g:brand><![CDATA[${product.brand || 'Baci'}]]></g:brand>
  ${itemGroupId}
  ${product.gtin ? `<g:gtin>${product.gtin}</g:gtin>` : ''}
  ${product.mpn ? `<g:mpn>${product.mpn}</g:mpn>` : ''}
  ${product.google_product_category ? `<g:google_product_category><![CDATA[${product.google_product_category}]]></g:google_product_category>` : ''}
  ${product.weight_value ? `<g:shipping_weight>${product.weight_value} ${product.weight_unit || 'kg'}</g:shipping_weight>` : ''}
</item>`;
      });

    const xml = `<?xml version="1.0"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
<channel>
<title>Baci Store Products</title>
<link>${siteUrl}</link>
<description>Product feed for Google Merchant Center</description>
${items.join('\n')}
</channel>
</rss>`;

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 's-maxage=3600, stale-while-revalidate',
      },
    });
  } catch (err) {
    console.error('Unexpected error generating feed:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
