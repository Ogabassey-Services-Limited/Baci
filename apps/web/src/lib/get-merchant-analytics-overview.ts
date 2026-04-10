import type {
  MerchantAnalyticsChartPoint,
  MerchantAnalyticsNamedValue,
  MerchantAnalyticsResponse,
  MerchantAnalyticsTopProduct,
} from '@baci/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sanitizeText } from '@/lib/sanitize-core';

interface AnalyticsOrderRow {
  created_at: string;
  customer_email: string | null;
  customer_id: string | null;
  customer_name: string | null;
  discount_amount: number | null;
  id: string;
  payment_method: string | null;
  payment_status: string | null;
  shipping_fee: number | null;
  source: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  total: number | null;
}

interface AnalyticsOrderItemRow {
  name: string | null;
  orders:
    | {
        created_at: string;
      }
    | Array<{
        created_at: string;
      }>
    | null;
  price: number | null;
  product_id: string | null;
  products:
    | {
        brand: string | null;
        cost_price: number | null;
      }
    | Array<{
        brand: string | null;
        cost_price: number | null;
      }>
    | null;
  quantity: number | null;
}

interface BlogPostRow {
  created_at: string;
  id: string;
  published_at: string | null;
  slug: string;
  status: string | null;
  title: string;
  view_count: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ANALYTICS_RANGE_DAYS = 366;

function asNumber(value: number | null | undefined) {
  return Number(value ?? 0);
}

function getPercentChange(current: number, previous: number) {
  // previous === 0: no baseline to measure against. Report +100% when the
  // metric actually rose from nothing, 0% when both are zero.
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }

  return ((current - previous) / previous) * 100;
}

function sanitizeBreakdownName(value: unknown) {
  const normalized = String(value ?? 'unknown')
    .trim()
    .toLowerCase();

  const knownLabels: Record<string, string> = {
    bank_transfer: 'Bank transfer',
    banktransfer: 'Bank transfer',
    card: 'Card',
    cash: 'Cash',
    offline: 'Offline',
    online_store: 'Online store',
    pay_on_delivery: 'Pay on delivery',
    pos: 'POS',
    transfer: 'Transfer',
    unknown: 'Unknown',
    wallet: 'Wallet',
    whatsapp: 'WhatsApp',
  };

  if (knownLabels[normalized]) {
    return knownLabels[normalized];
  }

  const withoutControlChars = Array.from(normalized)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('');

  const stripped = sanitizeText(withoutControlChars)
    .replace(/\s+/g, ' ')
    .trim();

  if (!stripped) {
    return 'Unknown';
  }

  return stripped.slice(0, 48);
}

function groupBreakdown(
  rows: AnalyticsOrderRow[],
  key: keyof AnalyticsOrderRow
) {
  const buckets = new Map<string, number>();

  for (const row of rows) {
    const name = sanitizeBreakdownName(row[key]);
    buckets.set(name, (buckets.get(name) ?? 0) + asNumber(row.total));
  }

  return Array.from(buckets.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value);
}

function buildChartData(
  rows: AnalyticsOrderRow[],
  orderItems: AnalyticsOrderItemRow[],
  startDate: Date,
  endDate: Date
) {
  const startDay = new Date(startDate);
  startDay.setUTCHours(0, 0, 0, 0);
  const endDay = new Date(endDate);
  endDay.setUTCHours(0, 0, 0, 0);
  const days = Math.max(
    1,
    Math.floor((endDay.getTime() - startDay.getTime()) / DAY_MS) + 1
  );
  const mode = days <= 31 ? 'day' : days <= 180 ? 'week' : 'month';
  const buckets = new Map<string, MerchantAnalyticsChartPoint>();

  // All bucket arithmetic is performed in UTC so bucket keys are stable
  // regardless of the server's local timezone.
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    const bucketStart = new Date(cursor);
    if (mode === 'week') {
      const day = bucketStart.getUTCDay();
      bucketStart.setUTCDate(bucketStart.getUTCDate() - day);
    } else if (mode === 'month') {
      bucketStart.setUTCDate(1);
    }
    bucketStart.setUTCHours(0, 0, 0, 0);

    const key = bucketStart.toISOString();
    const day =
      mode === 'month'
        ? bucketStart.toLocaleDateString('en-US', {
            month: 'short',
            timeZone: 'UTC',
          })
        : bucketStart.toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
            timeZone: 'UTC',
          });

    if (!buckets.has(key)) {
      buckets.set(key, { day, orders: 0, profit: 0, revenue: 0, tax: 0 });
    }

    cursor.setUTCDate(
      cursor.getUTCDate() + (mode === 'month' ? 32 : mode === 'week' ? 7 : 1)
    );
    if (mode === 'month') {
      cursor.setUTCDate(1);
    }
  }

  for (const row of rows) {
    const at = new Date(row.created_at);
    if (mode === 'week') {
      at.setUTCDate(at.getUTCDate() - at.getUTCDay());
    } else if (mode === 'month') {
      at.setUTCDate(1);
    }
    at.setUTCHours(0, 0, 0, 0);
    const key = at.toISOString();
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.orders = asNumber(bucket.orders) + 1;
      bucket.revenue += asNumber(row.total);
      bucket.tax = asNumber(bucket.tax) + asNumber(row.tax_amount);
    }
  }

  for (const item of orderItems) {
    const joinedOrder = Array.isArray(item.orders)
      ? item.orders[0]
      : item.orders;
    if (!joinedOrder) {
      continue;
    }

    const at = new Date(joinedOrder.created_at);
    if (mode === 'week') {
      at.setUTCDate(at.getUTCDate() - at.getUTCDay());
    } else if (mode === 'month') {
      at.setUTCDate(1);
    }
    at.setUTCHours(0, 0, 0, 0);

    const bucket = buckets.get(at.toISOString());
    if (bucket) {
      const joinedProduct = Array.isArray(item.products)
        ? item.products[0]
        : item.products;
      const quantity = asNumber(item.quantity ?? 1);
      bucket.profit =
        asNumber(bucket.profit) +
        (asNumber(item.price) - asNumber(joinedProduct?.cost_price)) * quantity;
    }
  }

  return Array.from(buckets.values());
}

function buildTopEntities(orderItems: AnalyticsOrderItemRow[]) {
  const products = new Map<string, MerchantAnalyticsTopProduct>();
  const brands = new Map<string, number>();
  let totalProfit = 0;
  let totalUnitsSold = 0;

  for (const item of orderItems) {
    const quantity = asNumber(item.quantity ?? 1);
    const price = asNumber(item.price);
    const revenue = quantity * price;
    const joinedProduct = Array.isArray(item.products)
      ? item.products[0]
      : item.products;
    const brand = joinedProduct?.brand?.trim() || 'Unknown';
    const cost = asNumber(joinedProduct?.cost_price);

    totalProfit += (price - cost) * quantity;
    totalUnitsSold += quantity;

    if (item.product_id) {
      const current = products.get(item.product_id) ?? {
        id: item.product_id,
        name: sanitizeText(item.name?.trim() || 'Product'),
        revenue: 0,
        units: 0,
      };
      current.revenue += revenue;
      current.units += quantity;
      products.set(item.product_id, current);
    }

    brands.set(brand, (brands.get(brand) ?? 0) + revenue);
  }

  const topProducts = Array.from(products.values()).sort(
    (left, right) => right.revenue - left.revenue
  );
  const topBrandEntry = Array.from(brands.entries()).sort(
    (left, right) => right[1] - left[1]
  )[0];

  return {
    brandBreakdown: Array.from(brands.entries())
      .map(([name, value]) => ({
        name: sanitizeText(name),
        revenue: value,
        value,
      }))
      .sort((left, right) => right.value - left.value),
    topBrand: topBrandEntry
      ? ({
          name: sanitizeText(topBrandEntry[0]),
          revenue: topBrandEntry[1],
          value: topBrandEntry[1],
        } satisfies MerchantAnalyticsNamedValue)
      : null,
    topProducts,
    totalProfit,
    totalUnitsSold,
  };
}

function buildCustomerBreakdown(orders: AnalyticsOrderRow[]) {
  // Key customers by stable ID when available so two unrelated customers
  // with the same display name don't collapse into a single row. Only fall
  // back to name as a last resort for pre-migration data without identifiers.
  const customers = new Map<string, MerchantAnalyticsNamedValue>();
  for (const order of orders) {
    const rawName =
      order.customer_name?.trim() ||
      order.customer_email?.trim() ||
      'Guest customer';
    const trimmedEmail = order.customer_email?.trim();
    const key =
      order.customer_id ?? (trimmedEmail ? trimmedEmail : `name:${rawName}`);
    const current = customers.get(key) ?? {
      name: sanitizeText(rawName),
      value: 0,
      revenue: 0,
    };
    current.value += 1;
    current.revenue = asNumber(current.revenue) + asNumber(order.total);
    customers.set(key, current);
  }

  return Array.from(customers.values()).sort((left, right) => {
    if (right.value !== left.value) return right.value - left.value;
    return asNumber(right.revenue) - asNumber(left.revenue);
  });
}

function getCustomerAnalyticsKey(order: AnalyticsOrderRow) {
  const trimmedEmail = order.customer_email?.trim();
  return order.customer_id ?? (trimmedEmail ? trimmedEmail : 'guest');
}

export async function getMerchantAnalyticsOverview(
  supabase: SupabaseClient,
  merchantId: string,
  startDate: Date,
  endDate: Date
): Promise<MerchantAnalyticsResponse> {
  const requestedRangeMs = endDate.getTime() - startDate.getTime();
  if (requestedRangeMs < 0) {
    throw new Error('Analytics start date must be on or before the end date');
  }

  const maxRangeMs = MAX_ANALYTICS_RANGE_DAYS * DAY_MS;
  if (requestedRangeMs > maxRangeMs) {
    throw new Error(
      `Analytics date range cannot exceed ${MAX_ANALYTICS_RANGE_DAYS} days`
    );
  }

  // Previous comparison window mirrors the current window's duration so the
  // two periods span the same number of milliseconds; the off-by-one guard on
  // previousEnd ensures no overlap with the current range.
  const duration = requestedRangeMs;
  const previousEnd = new Date(startDate.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - duration);

  const [
    currentOrdersResult,
    previousOrdersResult,
    currentOrderItemsResult,
    previousOrderItemsResult,
    recentOrdersResult,
    blogPostsResult,
    activeOrdersResult,
  ] = await Promise.all([
    // currentOrdersResult / previousOrdersResult intentionally include every
    // payment_status (paid, refunded, etc.) so we can compute refund rate
    // below. Paid-only subsets are derived in-memory via currentPaidOrders.
    supabase
      .from('orders')
      .select(
        'id, created_at, customer_email, customer_id, customer_name, discount_amount, payment_method, payment_status, shipping_fee, source, subtotal, tax_amount, total'
      )
      .eq('merchant_id', merchantId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString()),
    supabase
      .from('orders')
      .select(
        'id, created_at, customer_email, customer_id, customer_name, discount_amount, payment_method, payment_status, shipping_fee, source, subtotal, tax_amount, total'
      )
      .eq('merchant_id', merchantId)
      .gte('created_at', previousStart.toISOString())
      .lte('created_at', previousEnd.toISOString()),
    supabase
      .from('order_items')
      .select(
        'product_id, name, price, quantity, products(brand, cost_price), orders!inner(merchant_id, payment_status, created_at)'
      )
      .eq('orders.merchant_id', merchantId)
      .eq('orders.payment_status', 'paid')
      .gte('orders.created_at', startDate.toISOString())
      .lte('orders.created_at', endDate.toISOString()),
    supabase
      .from('order_items')
      .select(
        'product_id, name, price, quantity, products(brand, cost_price), orders!inner(merchant_id, payment_status, created_at)'
      )
      .eq('orders.merchant_id', merchantId)
      .eq('orders.payment_status', 'paid')
      .gte('orders.created_at', previousStart.toISOString())
      .lte('orders.created_at', previousEnd.toISOString()),
    supabase
      .from('orders')
      .select('id, created_at, customer_email, customer_name, total')
      .eq('merchant_id', merchantId)
      .eq('payment_status', 'paid')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('blog_posts')
      .select('id, title, slug, status, published_at, created_at, view_count')
      .eq('merchant_id', merchantId),
    // activeOrdersResult is a live "orders in the last hour" pulse; we
    // include all statuses because an unpaid order still counts as activity.
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchantId)
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()),
  ]);

  const firstError =
    currentOrdersResult.error ||
    previousOrdersResult.error ||
    currentOrderItemsResult.error ||
    previousOrderItemsResult.error ||
    recentOrdersResult.error ||
    blogPostsResult.error ||
    activeOrdersResult.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  const currentOrders = (currentOrdersResult.data ?? []) as AnalyticsOrderRow[];
  const previousOrders = (previousOrdersResult.data ??
    []) as AnalyticsOrderRow[];
  const currentPaidOrders = currentOrders.filter(
    (order) => order.payment_status === 'paid'
  );
  const previousPaidOrders = previousOrders.filter(
    (order) => order.payment_status === 'paid'
  );
  const currentItems = (currentOrderItemsResult.data ??
    []) as AnalyticsOrderItemRow[];
  const previousItems = (previousOrderItemsResult.data ??
    []) as AnalyticsOrderItemRow[];
  const currentEntities = buildTopEntities(currentItems);
  const previousEntities = buildTopEntities(previousItems);

  const currentRevenue = currentPaidOrders.reduce(
    (sum, order) => sum + asNumber(order.total),
    0
  );
  const previousRevenue = previousPaidOrders.reduce(
    (sum, order) => sum + asNumber(order.total),
    0
  );
  // Guest orders (no customer_id and no email) are collapsed into a single
  // "guest" bucket so a burst of anonymous checkouts doesn't look like N
  // different customers.
  const currentCustomers = new Set(
    currentPaidOrders.map(getCustomerAnalyticsKey)
  ).size;
  const previousCustomers = new Set(
    previousPaidOrders.map(getCustomerAnalyticsKey)
  ).size;
  const currentTax = currentPaidOrders.reduce(
    (sum, order) => sum + asNumber(order.tax_amount),
    0
  );
  const previousTax = previousPaidOrders.reduce(
    (sum, order) => sum + asNumber(order.tax_amount),
    0
  );
  const currentRefundRate =
    currentOrders.length > 0
      ? (currentOrders.filter((order) => order.payment_status === 'refunded')
          .length /
          currentOrders.length) *
        100
      : 0;
  const previousRefundRate =
    previousOrders.length > 0
      ? (previousOrders.filter((order) => order.payment_status === 'refunded')
          .length /
          previousOrders.length) *
        100
      : 0;
  const salesByPaymentMethod = groupBreakdown(
    currentPaidOrders,
    'payment_method'
  );
  const topPaymentMethodEntry = salesByPaymentMethod[0];
  const totalPaymentMethodValue = salesByPaymentMethod.reduce(
    (sum, entry) => sum + entry.value,
    0
  );
  const blogPosts = (blogPostsResult.data ?? []) as BlogPostRow[];
  const customerBreakdown = buildCustomerBreakdown(currentPaidOrders);
  const topPost =
    [...blogPosts].sort(
      (left, right) => asNumber(right.view_count) - asNumber(left.view_count)
    )[0] ?? null;
  const currentAov =
    currentPaidOrders.length > 0
      ? currentRevenue / currentPaidOrders.length
      : 0;
  const previousAov =
    previousPaidOrders.length > 0
      ? previousRevenue / previousPaidOrders.length
      : 0;
  const currentGrossMargin =
    currentRevenue > 0
      ? (currentEntities.totalProfit / currentRevenue) * 100
      : 0;
  const previousGrossMargin =
    previousRevenue > 0
      ? (previousEntities.totalProfit / previousRevenue) * 100
      : 0;

  return {
    blog: {
      draftPosts: blogPosts.filter((post) => post.status !== 'published')
        .length,
      publishedPosts: blogPosts.filter((post) => post.status === 'published')
        .length,
      topPost: topPost
        ? {
            id: topPost.id,
            slug: topPost.slug,
            title: sanitizeText(topPost.title),
            viewCount: asNumber(topPost.view_count),
          }
        : null,
      totalPosts: blogPosts.length,
      totalViews: blogPosts.reduce(
        (sum, post) => sum + asNumber(post.view_count),
        0
      ),
    },
    brandBreakdown: currentEntities.brandBreakdown,
    chartData: buildChartData(
      currentPaidOrders,
      currentItems,
      startDate,
      endDate
    ),
    customerBreakdown,
    recentSales: (recentOrdersResult.data ?? []).map((order) => ({
      amount: asNumber(order.total),
      email: sanitizeText(order.customer_email ?? ''),
      id: order.id,
      name: sanitizeText(order.customer_name ?? 'Customer'),
      time: order.created_at,
    })),
    salesByChannel: groupBreakdown(currentPaidOrders, 'source'),
    salesByPaymentMethod,
    summary: {
      activeNow: { change: 0, value: activeOrdersResult.count ?? 0 },
      aov: {
        change: getPercentChange(currentAov, previousAov),
        value: currentAov,
      },
      customers: {
        change: getPercentChange(currentCustomers, previousCustomers),
        value: currentCustomers,
      },
      discounts: currentPaidOrders.reduce(
        (sum, order) => sum + asNumber(order.discount_amount),
        0
      ),
      grossMargin: {
        change: getPercentChange(currentGrossMargin, previousGrossMargin),
        value: currentGrossMargin,
      },
      revenuePerCustomer: {
        change: getPercentChange(
          currentCustomers > 0 ? currentRevenue / currentCustomers : 0,
          previousCustomers > 0 ? previousRevenue / previousCustomers : 0
        ),
        value: currentCustomers > 0 ? currentRevenue / currentCustomers : 0,
      },
      profit: {
        change: getPercentChange(
          currentEntities.totalProfit,
          previousEntities.totalProfit
        ),
        value: currentEntities.totalProfit,
      },
      refundRate: {
        change: currentRefundRate - previousRefundRate,
        value: currentRefundRate,
      },
      revenue: {
        change: getPercentChange(currentRevenue, previousRevenue),
        value: currentRevenue,
      },
      sales: {
        change: getPercentChange(
          currentPaidOrders.length,
          previousPaidOrders.length
        ),
        value: currentPaidOrders.length,
      },
      shipping: currentPaidOrders.reduce(
        (sum, order) => sum + asNumber(order.shipping_fee),
        0
      ),
      subtotal: currentPaidOrders.reduce(
        (sum, order) => sum + asNumber(order.subtotal),
        0
      ),
      tax: currentTax,
      taxDue: {
        change: getPercentChange(currentTax, previousTax),
        value: currentTax,
      },
      totalUnitsSold: currentEntities.totalUnitsSold,
    },
    topBrand: currentEntities.topBrand,
    topCustomer: customerBreakdown[0] ?? null,
    topPaymentMethod: topPaymentMethodEntry
      ? {
          name: topPaymentMethodEntry.name,
          value:
            totalPaymentMethodValue > 0
              ? (topPaymentMethodEntry.value / totalPaymentMethodValue) * 100
              : 0,
        }
      : null,
    topProducts: currentEntities.topProducts.slice(0, 10),
  };
}
