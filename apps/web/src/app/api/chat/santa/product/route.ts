import { type NextRequest, NextResponse } from 'next/server';
import { getCachedSantaProductList } from '@/ai/santa-data';
import { createServiceClient } from '@/lib/supabase/service';

const OGABASSEY_MERCHANT_ID = '063f1367-a2f2-4ec3-a626-d183050c99a0';

/**
 * Common handler for product lookup
 */
async function handleProductLookup(productName: string): Promise<NextResponse> {
  // Sanitize for safe logging (prevent log injection)
  const safeProductName = productName.replace(/[\r\n\t]/g, ' ').slice(0, 200);
  try {
    // Get products directly (bypass cache to ensure consistency)
    const santaProducts = await getCachedSantaProductList(
      OGABASSEY_MERCHANT_ID
    );

    console.log(
      '[Santa Product] Searching in',
      santaProducts.length,
      'products for:',
      safeProductName
    );

    // Find the best match by name
    const normalizedSearch = productName.toLowerCase().trim();
    const matchingProduct = santaProducts.find(
      (p) =>
        p.name.toLowerCase() === normalizedSearch ||
        p.name.toLowerCase().includes(normalizedSearch) ||
        normalizedSearch.includes(p.name.toLowerCase())
    );

    if (!matchingProduct) {
      console.log('[Santa Product] No match found for:', safeProductName);
      return NextResponse.json({ product: null });
    }

    console.log(
      '[Santa Product] Found match:',
      matchingProduct.name
        .slice(0, 100)
        .replace(/[\r\n]/g, ' ')
        .replace(/[^\x20-\x7E]/g, '')
    );

    // Now get the full product details from database
    const supabase = createServiceClient();
    const { data: fullProduct, error } = await supabase
      .from('products')
      .select(
        'id, name, description, price, images, status, merchant_id, stock, manage_stock, brand, sku'
      )
      .eq('merchant_id', OGABASSEY_MERCHANT_ID)
      .eq('name', matchingProduct.name)
      .single();

    if (error || !fullProduct) {
      console.log(
        '[Santa Product] Could not fetch full product details:',
        error?.message
      );
      // Return basic product info from Santa data
      return NextResponse.json({
        product: {
          id: '', // No ID available
          name: matchingProduct.name,
          description: '',
          price: matchingProduct.price,
          image: '',
          imageLarge: '',
          imageHint: matchingProduct.name,
          status: 'active',
          merchant_id: OGABASSEY_MERCHANT_ID,
          stock: 100,
          manage_stock: false,
          brand: '',
          sku: '',
          gtin: '',
          mpn: '',
        },
      });
    }

    // Extract image from images array
    type ImageEntry = string | { url?: string };
    const images = fullProduct.images as ImageEntry[] | null;
    let imageUrl = '';
    if (images && images.length > 0) {
      const firstImage = images[0];
      imageUrl =
        typeof firstImage === 'string' ? firstImage : firstImage?.url || '';
    }

    // Return full product with proper format
    return NextResponse.json({
      product: {
        id: fullProduct.id,
        name: fullProduct.name,
        description: fullProduct.description || '',
        price: fullProduct.price,
        image: imageUrl,
        imageLarge: imageUrl,
        imageHint: fullProduct.name,
        status: fullProduct.status,
        merchant_id: fullProduct.merchant_id,
        stock: fullProduct.stock || 0,
        manage_stock: fullProduct.manage_stock || false,
        brand: fullProduct.brand || '',
        sku: fullProduct.sku || '',
        gtin: '',
        mpn: '',
      },
    });
  } catch (err) {
    console.error('[Santa Product] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/chat/santa/product
 * Body: { name: "ProductName" }
 *
 * Product lookup for Santa's cart integration.
 * Uses POST to work around GET route isolation issues.
 */
export async function POST(request: NextRequest) {
  let productName: string | null = null;

  try {
    const body = await request.json();
    productName = body.name;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!productName) {
    return NextResponse.json(
      { error: 'Product name is required' },
      { status: 400 }
    );
  }

  return handleProductLookup(productName);
}

/**
 * GET /api/chat/santa/product?name=ProductName
 *
 * Product lookup for Santa's cart integration.
 * Note: May not work in all contexts due to Next.js route isolation.
 * Prefer using POST endpoint.
 */
export function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const productName = searchParams.get('name');

  if (!productName) {
    return NextResponse.json(
      { error: 'Product name is required' },
      { status: 400 }
    );
  }

  return handleProductLookup(productName);
}
