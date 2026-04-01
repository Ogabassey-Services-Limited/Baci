import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isValidUuid, sanitizeForLog } from '@/lib/sanitize-core';
import { createAdminClient } from '@/lib/supabase/admin';
import { createAnonClient } from '@/lib/supabase/anon';
import { createClient } from '@/lib/supabase/server';

// GET /api/storefront/orders/[id] - Fetch order details for resuming checkout or BNPL flows

interface OrderItem {
  id: string;
  product_id: string;
  variant_name?: string;
  product_name?: string;
  name?: string;
  quantity: number;
  price: number;
  product_images?: string[];
  product_slug?: string;
  category?: string;
  category_slug?: string;
  categories?: { name?: string; slug?: string } | null;
  products?:
    | {
        slug?: string;
        category?: string;
        category_slug?: string;
        categories?:
          | { name?: string; slug?: string }[]
          | { name?: string; slug?: string }
          | null;
      }
    | {
        slug?: string;
        category?: string;
        category_slug?: string;
        categories?:
          | { name?: string; slug?: string }[]
          | { name?: string; slug?: string }
          | null;
      }[]
    | null;
}

function extractJoinedProduct(products: OrderItem['products']): {
  slug?: string;
  category?: string;
  category_slug?: string;
  categories?:
    | { name?: string; slug?: string }[]
    | { name?: string; slug?: string }
    | null;
} | null {
  return Array.isArray(products) ? products[0] || null : products || null;
}

function flattenOrderItemProductData(item: OrderItem) {
  const product = extractJoinedProduct(item.products);
  const categories = Array.isArray(product?.categories)
    ? product?.categories[0] || null
    : product?.categories || item.categories || null;

  return {
    product_slug: product?.slug || item.product_slug,
    category: product?.category || item.category,
    category_slug: product?.category_slug || item.category_slug,
    categories,
  };
}

async function fetchProductRouteDetails(
  items: OrderItem[],
  loadProducts: (productIds: string[]) => Promise<{
    data: Array<{
      id: string;
      slug: string | null;
      category: string | null;
      category_slug: string | null;
      categories?:
        | { name?: string; slug?: string }[]
        | { name?: string; slug?: string }
        | null;
    }> | null;
    error: { message?: string } | null;
  }>
) {
  const productIds = Array.from(
    new Set(
      items
        .map((item) => item.product_id)
        .filter((value): value is string => Boolean(value))
    )
  );

  if (productIds.length === 0) {
    return new Map<string, ReturnType<typeof flattenOrderItemProductData>>();
  }

  const { data, error } = await loadProducts(productIds);

  if (error || !data) {
    console.warn(
      'Failed to fetch product route details for order items',
      error
    );
    return new Map<string, ReturnType<typeof flattenOrderItemProductData>>();
  }

  return new Map(
    data.map((product) => [
      product.id,
      {
        product_slug: product.slug,
        category: product.category,
        category_slug: product.category_slug,
        categories: Array.isArray(product.categories)
          ? product.categories[0] || null
          : product.categories || null,
      },
    ])
  );
}

function mapOrderItemsWithRoutes(
  items: OrderItem[],
  productRouteDetails?: Map<
    string,
    {
      product_slug?: string | null;
      category?: string | null;
      category_slug?: string | null;
      categories?: { name?: string; slug?: string } | null;
    }
  >
) {
  return items.map((item: OrderItem) => {
    const displayName = item.product_name || item.name || '';
    return {
      id: item.id,
      product_id: item.product_id,
      product_name: displayName,
      name: displayName,
      quantity: item.quantity,
      price: item.price,
      product_images: item.product_images,
      ...flattenOrderItemProductData(item),
      ...(productRouteDetails?.get(item.product_id) || {}),
    };
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const token =
      searchParams.get('token') ||
      searchParams.get('tracking_token') ||
      undefined;
    const email = searchParams.get('email') || undefined;
    const merchantSlug =
      searchParams.get('merchant_slug') ||
      searchParams.get('slug') ||
      undefined;

    const parsed = z
      .object({
        token: z.string().min(1).optional(),
        email: z.string().email().optional(),
        merchant_slug: z.string().min(1).optional(),
      })
      .safeParse({ token, email, merchant_slug: merchantSlug });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    console.log(
      '[API/Orders] Fetching order %s. User present: %s, merchant_slug: %s',
      sanitizeForLog(id),
      !!user,
      sanitizeForLog(merchantSlug)
    );

    if (user) {
      if (!isValidUuid(id)) {
        return NextResponse.json(
          { error: 'Invalid order ID' },
          { status: 400 }
        );
      }

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(
          `
            id,
            order_number,
            tracking_token,
            subtotal,
            shipping_fee,
            total,
            customer_name,
            customer_email,
            customer_phone,
            shipping_address,
            payment_status,
            shipping_status,
            payment_method,
            merchant_id
          `
        )
        .eq('id', id)
        .single();

      if (orderError || !order) {
        // Fall through to public lookup if not found by session (e.g. guest order, different account)
        console.debug(
          '[API/Orders] Order %s not found via session lookup. Error:',
          sanitizeForLog(id),
          orderError?.message
        );
      } else {
        console.log(
          '[API/Orders] Found order %s via session lookup.',
          sanitizeForLog(id)
        );
        const { data: items, error: itemsError } = await supabase
          .from('order_items')
          .select(
            `
              id,
              product_id,
              variant_name,
              product_name:name,
              quantity,
              price,
              products:products!order_items_product_id_fkey (
                slug,
                category,
                category_slug,
                categories:categories (
                  name,
                  slug
                )
              )
            `
          )
          .eq('order_id', order.id);

        if (itemsError) {
          console.error(
            '[API/Orders] Items fetch error (session):',
            itemsError
          );
        }

        return NextResponse.json({
          ...order,
          shipping_cost: order.shipping_fee,
          short_id: order.order_number,
          items: mapOrderItemsWithRoutes(items || []),
        });
      }
    }

    // Subdomain requests: the proxy sets x-merchant-slug for storefront subdomains.
    // Use admin client to fetch order by ID, validating merchant ownership.
    // This enables BNPL launcher and other checkout flows that don't have
    // auth cookies or tracking tokens (e.g. mobile WebView, guest checkout).
    const rawProxySlug = request.headers.get('x-merchant-slug');
    // Sanitize header value before logging to prevent log injection
    const proxyMerchantSlug = rawProxySlug
      ? rawProxySlug.replace(/[\n\r\t]/g, '').slice(0, 100)
      : null;
    if (proxyMerchantSlug && isValidUuid(id)) {
      console.log(
        '[API/Orders] Attempting header-based lookup for slug:',
        proxyMerchantSlug
      );
      const admin = createAdminClient();

      const { data: merchant } = await admin
        .from('merchants')
        .select('id')
        .eq('slug', proxyMerchantSlug)
        .single();

      if (merchant) {
        console.log(
          '[API/Orders] Found merchant %s for slug %s',
          merchant.id,
          proxyMerchantSlug
        );
        const { data: order, error: orderError } = await admin
          .from('orders')
          .select(
            `id, order_number, tracking_token, subtotal, shipping_fee, total,
             customer_name, customer_email, customer_phone, shipping_address,
             payment_status, shipping_status, payment_method, merchant_id`
          )
          .eq('id', id)
          .eq('merchant_id', merchant.id)
          .single();

        if (!orderError && order) {
          console.log(
            '[API/Orders] Found order %s via header-based lookup.',
            sanitizeForLog(id)
          );
          const { data: items } = await admin
            .from('order_items')
            .select(
              `
                id,
                product_id,
                variant_name,
                product_name:name,
                quantity,
                price,
                products:products!order_items_product_id_fkey (
                  slug,
                  category,
                  category_slug,
                  categories:categories (
                    name,
                    slug
                  )
                )
              `
            )
            .eq('order_id', order.id);

          return NextResponse.json({
            ...order,
            shipping_cost: order.shipping_fee,
            short_id: order.order_number,
            items: mapOrderItemsWithRoutes(items || []),
          });
        } else {
          console.debug(
            '[API/Orders] Order %s not found for merchant %s via header.',
            sanitizeForLog(id),
            merchant.id
          );
        }
      } else {
        console.debug(
          '[API/Orders] Merchant not found for header slug: %s',
          proxyMerchantSlug
        );
      }
      // Fall through to other lookup methods if merchant/order not found
    }

    if (!merchantSlug) {
      return NextResponse.json(
        { error: 'merchant_slug is required for public order lookup' },
        { status: 400 }
      );
    }

    // Direct lookup by merchant_slug + order UUID (for BNPL launcher, guest checkout flows)
    if (!token && !email && isValidUuid(id)) {
      console.log(
        '[API/Orders] Attempting slug-based public lookup for merchant_slug: %s',
        sanitizeForLog(merchantSlug)
      );
      const admin = createAdminClient();
      const { data: merchantRow } = await admin
        .from('merchants')
        .select('id')
        .eq('slug', merchantSlug)
        .single();

      if (merchantRow) {
        console.log(
          '[API/Orders] Found merchant %s for slug %s',
          sanitizeForLog(merchantRow.id),
          sanitizeForLog(merchantSlug)
        );
        const { data: order, error: orderError } = await admin
          .from('orders')
          .select(
            `id, order_number, tracking_token, subtotal, shipping_fee, total,
             customer_name, customer_email, customer_phone, shipping_address,
             payment_status, shipping_status, payment_method, merchant_id`
          )
          .eq('id', id)
          .eq('merchant_id', merchantRow.id)
          .single();

        if (!orderError && order) {
          console.log(
            '[API/Orders] Found order %s via slug-based lookup.',
            sanitizeForLog(id)
          );
          const { data: items } = await admin
            .from('order_items')
            .select(
              `
                id,
                product_id,
                variant_name,
                product_name:name,
                quantity,
                price,
                products:products!order_items_product_id_fkey (
                  slug,
                  category,
                  category_slug,
                  categories:categories (
                    name,
                    slug
                  )
                )
              `
            )
            .eq('order_id', order.id);

          return NextResponse.json({
            ...order,
            shipping_cost: order.shipping_fee,
            short_id: order.order_number,
            items: mapOrderItemsWithRoutes(items || []),
          });
        } else {
          console.warn(
            '[API/Orders] Order %s not found for merchant %s via slug. Error:',
            sanitizeForLog(id),
            merchantRow.id,
            orderError?.message
          );
        }
      } else {
        console.warn(
          '[API/Orders] Merchant row not found for slug: %s',
          sanitizeForLog(merchantSlug)
        );
      }

      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (!token && !email) {
      return NextResponse.json(
        { error: 'Tracking token or email is required' },
        { status: 400 }
      );
    }

    if (!token && !isValidUuid(id)) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    }

    const anon = createAnonClient();
    const { data: orders, error } = await anon.rpc('get_order_tracking', {
      p_merchant_slug: merchantSlug,
      p_order_id: token ? null : id,
      p_order_number: null,
      p_email: token ? null : email,
      p_tracking_token: token || null,
    });

    const order = Array.isArray(orders) ? orders[0] : null;

    if (error || !order) {
      console.error('Storefront order fetch error:', error);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const rawItems: OrderItem[] = Array.isArray(order.items) ? order.items : [];
    const productRouteDetails = await fetchProductRouteDetails(
      rawItems,
      async (productIds) =>
        anon
          .from('products')
          .select(`
            id,
            slug,
            category,
            category_slug,
            categories:categories (
              name,
              slug
            )
          `)
          .in('id', productIds)
    );
    const items = mapOrderItemsWithRoutes(rawItems, productRouteDetails);

    return NextResponse.json({
      id: order.id,
      order_number: order.order_number,
      short_id: order.order_number,
      subtotal: order.subtotal,
      shipping_cost: order.shipping_cost ?? order.shipping_fee ?? 0,
      total: order.total,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      customer_phone: order.customer_phone,
      shipping_address: order.shipping_address,
      payment_status: order.payment_status,
      shipping_status: order.shipping_status,
      payment_method: order.payment_method,
      merchant_id: order.merchant_id,
      tracking_token: token || null,
      items,
    });
  } catch (error) {
    console.error(
      'Unexpected error in GET /api/storefront/orders/[id]:',
      error
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
