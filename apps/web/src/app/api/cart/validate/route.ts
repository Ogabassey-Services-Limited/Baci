import { type NextRequest, NextResponse } from 'next/server';
import { getEffectiveStock } from '@/lib/product-stock';
import { createClient } from '@/lib/supabase/server';
import { cartValidateSchema } from '@/schemas/cart';

type CartProductRow = {
  id: string;
  name: string;
  price: number | string | null;
  stock: number | null;
  stock_quantity: number | null;
  status: string | null;
  manage_stock: boolean | null;
};

type CartVariantRow = {
  id: string;
  product_id: string;
  price_override: number | string | null;
};

type CartValidationItem = {
  id: string;
  price: number | null;
  variantId?: string;
};

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeVariantId(
  item: { variantId?: string; variant_id?: string } | undefined
) {
  return item?.variantId || item?.variant_id || undefined;
}

function toPriceNumber(value: number | string | null | undefined) {
  const price = Number(value ?? 0);
  return Number.isFinite(price) ? price : 0;
}

function getCartValidationKey(id: string, variantId?: string) {
  return variantId ? `${id}::${variantId}` : id;
}

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
 *   priceChanges: { id, variantId?, oldPrice, newPrice }[]
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

    // Support both formats: just IDs or full cart items with prices.
    const validationItems: CartValidationItem[] = cartItems
      ? cartItems.map((item) => ({
          id: item.id,
          price: item.price,
          variantId: normalizeVariantId(item),
        }))
      : (productIds ?? []).map((id) => ({ id, price: null }));
    const idsToValidate = validationItems.map((item) => item.id);

    if (!idsToValidate.length) {
      return NextResponse.json({
        validProducts: [],
        invalidProductIds: [],
        priceChanges: [],
      });
    }

    const validFormatIds: string[] = [];
    const invalidFormatIds: string[] = [];
    const validVariantIds = Array.from(
      new Set(
        validationItems
          .map((item) => item.variantId)
          .filter(
            (variantId): variantId is string =>
              typeof variantId === 'string' && uuidRegex.test(variantId)
          )
      )
    );

    const supabase = await createClient();

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

    let products: CartProductRow[] = [];
    if (validFormatIds.length > 0) {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, stock, stock_quantity, status, manage_stock')
        .in('id', validFormatIds)
        .returns<CartProductRow[]>();

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

    let variants: CartVariantRow[] = [];
    if (validVariantIds.length > 0 && validFormatIds.length > 0) {
      const { data, error } = (await supabase.rpc(
        'get_storefront_product_variants',
        {
          p_product_ids: Array.from(new Set(validFormatIds)),
        }
      )) as {
        data: CartVariantRow[] | null;
        error: { message: string } | null;
      };

      if (error) {
        console.error('Cart validation variant query error:', error);
        return NextResponse.json(
          { error: `Failed to validate cart: ${error.message}` },
          { status: 500 }
        );
      }
      variants = data || [];
    }

    const productMap = new Map(products.map((p) => [String(p.id), p]));
    const variantMap = new Map(
      variants.map((variant) => [variant.id, variant])
    );

    const validProducts: {
      id: string;
      price: number;
      stock: number;
      manage_stock: boolean;
      name: string;
    }[] = [];
    const invalidProductIds: string[] = [...invalidFormatIds]; // Start with known junk
    const priceChanges: {
      id: string;
      variantId?: string;
      oldPrice: number;
      newPrice: number;
    }[] = [];
    const seenPriceChangeKeys = new Set<string>();

    for (const item of validationItems) {
      const strId = String(item.id);
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
        const variant = item.variantId ? variantMap.get(item.variantId) : null;
        const variantBelongsToProduct =
          variant && String(variant.product_id) === strId;
        const currentPrice = toPriceNumber(
          variantBelongsToProduct
            ? (variant.price_override ?? product.price)
            : product.price
        );

        validProducts.push({
          id: String(product.id), // Ensure string
          price: currentPrice,
          stock: getEffectiveStock(product),
          name: product.name,
          manage_stock: Boolean(product.manage_stock),
        });

        if (item.price !== null && item.price !== currentPrice) {
          const priceChangeKey = getCartValidationKey(strId, item.variantId);
          if (!seenPriceChangeKeys.has(priceChangeKey)) {
            seenPriceChangeKeys.add(priceChangeKey);
            priceChanges.push({
              id: strId,
              variantId: item.variantId,
              oldPrice: item.price,
              newPrice: currentPrice,
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
