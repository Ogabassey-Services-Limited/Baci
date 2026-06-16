import { type NextRequest, NextResponse } from 'next/server';
import { getCachedSantaProductList } from '@/ai/santa-data';
import { logger } from '@/lib/logger';
import { getEffectiveStock } from '@/lib/product-stock';
import { sanitizeForLog } from '@/lib/sanitize-core';
import { createServiceClient } from '@/lib/supabase/service';

// Ogabassey merchant ID — single source of truth across all chat endpoints
const OGABASSEY_MERCHANT_ID = '3bc72679-c0f7-4db4-9054-6a4a4a95a498';
const UNLIMITED_STOCK_QUANTITY = 9999;

/**
 * Common handler for product lookup
 */
async function handleProductLookup(productName: string): Promise<NextResponse> {
  // Sanitize for safe logging (prevent log injection)
  const safeProductName = sanitizeForLog(productName);
  try {
    // Get products directly (bypass cache to ensure consistency)
    const santaProducts = await getCachedSantaProductList(
      OGABASSEY_MERCHANT_ID
    );

    logger.info({
      message: 'Santa Product searching',
      count: santaProducts.length,
      productName: safeProductName,
    });

    // Find the best match by name
    const normalizedSearch = productName.toLowerCase().trim();
    const matchingProduct = santaProducts.find(
      (p) =>
        p.name.toLowerCase() === normalizedSearch ||
        p.name.toLowerCase().includes(normalizedSearch) ||
        normalizedSearch.includes(p.name.toLowerCase())
    );

    if (!matchingProduct) {
      logger.info({
        message: 'Santa Product no match found',
        productName: safeProductName,
      });
      return NextResponse.json({ product: null });
    }

    logger.info({
      message: 'Santa Product found match',
      match: matchingProduct.name,
    });

    // Now get the full product details from database
    const supabase = createServiceClient();
    const { data: fullProduct, error } = await supabase
      .from('products')
      .select(
        'id, name, slug, description, price, images, status, merchant_id, stock, stock_quantity, manage_stock, brand, sku'
      )
      .eq('merchant_id', OGABASSEY_MERCHANT_ID)
      .eq('name', matchingProduct.name)
      .single();

    if (error || !fullProduct) {
      logger.warn({
        message: 'Santa Product could not fetch full details',
        error: error?.message,
        match: matchingProduct.name,
      });
      // Return basic product info from Santa data
      return NextResponse.json({
        product: {
          id: '', // No ID available
          name: matchingProduct.name,
          slug: '',
          description: '',
          price: matchingProduct.price,
          image: '',
          imageLarge: '',
          imageHint: matchingProduct.name,
          status: 'active',
          merchant_id: OGABASSEY_MERCHANT_ID,
          stock: UNLIMITED_STOCK_QUANTITY,
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
    const stock =
      fullProduct.manage_stock === false
        ? UNLIMITED_STOCK_QUANTITY
        : getEffectiveStock(fullProduct);

    return NextResponse.json({
      product: {
        id: fullProduct.id,
        name: fullProduct.name,
        slug: fullProduct.slug || '',
        description: fullProduct.description || '',
        price: fullProduct.price,
        image: imageUrl,
        imageLarge: imageUrl,
        imageHint: fullProduct.name,
        status: fullProduct.status,
        merchant_id: fullProduct.merchant_id,
        stock,
        manage_stock: fullProduct.manage_stock ?? true,
        brand: fullProduct.brand || '',
        sku: fullProduct.sku || '',
        gtin: '',
        mpn: '',
      },
    });
  } catch (err) {
    logger.error({
      message: 'Santa Product internal error',
      error: err,
      productName: safeProductName,
    });
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

  if (!productName || typeof productName !== 'string') {
    return NextResponse.json(
      { error: 'Product name is required' },
      { status: 400 }
    );
  }

  if (productName.length > 200) {
    return NextResponse.json(
      { error: 'Product name too long' },
      { status: 400 }
    );
  }

  return handleProductLookup(productName.trim());
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
