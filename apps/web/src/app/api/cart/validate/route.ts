import { type NextRequest, NextResponse } from 'next/server';
import { getEffectiveStock } from '@/lib/product-stock';
import { createServiceClient } from '@/lib/supabase/service';
import { cartValidateSchema } from '@/schemas/cart';

/**
 * POST /api/cart/validate
 *
 * Validates cart items against the database.
 * Returns which products exist, their current prices, and stock status.
 *
 * Body: { productIds: string[] }
 * Response: {
 *   validProducts: { id, price, stock, name }[],
 *   invalidProductIds: string[],
 *   priceChanges: { id, oldPrice, newPrice }[]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = cartValidateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { productIds, cartItems } = parsed.data;

    // Support both formats: just IDs or full cart items with prices
    const idsToValidate = productIds || cartItems?.map((item) => item.id) || [];

    if (!idsToValidate.length) {
      return NextResponse.json({
        validProducts: [],
        invalidProductIds: [],
        priceChanges: [],
      });
    }

    // 1. Separate potentially valid IDs (must be valid UUIDs for this database)
    // 1. Separate potentially valid IDs
    const validFormatIds: string[] = [];
    const invalidFormatIds: string[] = [];

    // Use Service Client (Admin) to bypass RLS.
    // This ensures we can validate products even if the user is a guest.
    const supabase = createServiceClient();

    // UUID v4 regex pattern
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    for (const id of idsToValidate) {
      const strId = String(id);
      // Only accept valid UUIDs - the products table uses UUID primary key
      if (uuidRegex.test(strId)) {
        validFormatIds.push(strId);
      } else {
        // Log invalid format for debugging (sanitize to prevent log injection)
        const safeId = strId.replace(/[\r\n]/g, '').substring(0, 50);
        console.warn(`Cart contains invalid product ID format: "${safeId}"`);
        invalidFormatIds.push(strId);
      }
    }

    // 2. Fetch only valid-formatted IDs
    // biome-ignore lint/suspicious/noExplicitAny: Supabase returns dynamic rows
    let products: any[] = [];
    if (validFormatIds.length > 0) {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, stock, stock_quantity, status, manage_stock')
        .in('id', validFormatIds);

      if (error) {
        console.error('Cart validation query error:', error);
        // Don't fail entire request, just return what we know (unsafe IDs are definitely invalid)
        // But safer to fail if DB is down. However, typical error is "invalid input syntax"
        // which we avoided by filtering. So if error now, it's real DB error.
        return NextResponse.json(
          { error: `Failed to validate cart: ${error.message}` },
          { status: 500 }
        );
      }
      products = data || [];
    }

    // 3. Map for lookup (normalize keys to string to be safe)
    const productMap = new Map(products.map((p) => [String(p.id), p]));

    const validProducts: {
      id: string;
      price: number;
      stock: number;
      manage_stock: boolean;
      name: string;
    }[] = [];
    const invalidProductIds: string[] = [...invalidFormatIds]; // Start with known junk
    const priceChanges: { id: string; oldPrice: number; newPrice: number }[] =
      [];

    // 4. Validate all input IDs
    for (const id of idsToValidate) {
      const strId = String(id);
      // If it was junk, it's already in invalidProductIds (but we need to avoid adding it twice if using set?)
      // Actually simpler: iterate idsToValidate. check map.

      // If it was invalid format, map.get will be undefined.
      const product = productMap.get(strId);

      // Check status instead of is_published
      if (!product || product.status !== 'active') {
        // Product doesn't exist or is unpublished
        // Only mark as invalid if we actually checked it (i.e., it was a valid UUID that wasn't found)
        // OR if we found it but it's not active
        if (product) {
          // Found but not active -> Invalid
          if (!invalidProductIds.includes(strId)) invalidProductIds.push(strId);
        } else {
          // Not found.
          // If it was a valid UUID and not found, it's invalid.
          // If it was INVALID credentials (skipped DB check), we KEEP it (fail open) to support mock/legacy IDs.
          const isUuid = uuidRegex.test(strId);
          if (isUuid && !invalidProductIds.includes(strId)) {
            invalidProductIds.push(strId);
          }
        }
      } else {
        validProducts.push({
          id: String(product.id), // Ensure string
          price: product.price,
          stock: getEffectiveStock(product),
          name: product.name,
          manage_stock: product.manage_stock,
        });

        // Check for price changes
        if (cartItems) {
          const cartItem = cartItems.find((item) => String(item.id) === strId);
          if (cartItem && cartItem.price !== product.price) {
            priceChanges.push({
              id: strId,
              oldPrice: cartItem.price,
              newPrice: product.price,
            });
          }
        }
      }
    }

    return NextResponse.json({
      validProducts,
      invalidProductIds,
      priceChanges,
    });
  } catch (error) {
    console.error('Cart validation error:', error);
    return NextResponse.json(
      { error: 'Failed to validate cart' },
      { status: 500 }
    );
  }
}
