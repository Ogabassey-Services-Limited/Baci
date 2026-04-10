import type {
  MerchantAnalyticsChartPoint,
  MerchantAnalyticsNamedValue,
  MerchantAnalyticsResponse,
  MerchantAnalyticsTopProduct,
} from '@baci/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

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

function asNumber(value: number | null | undefined) {
  return Number(value ?? 0);
}

function getPercentChange(current: number, previous: number) {
  if (previous <= 0) {
    return current > 0 ? 100 : 0;
  }

  return ((current - previous) / previous) * 100;
}

function groupBreakdown(
  rows: AnalyticsOrderRow[],
  key: keyof AnalyticsOrderRow
) {
  const buckets = new Map<string, number>();

  for (const row of rows) {
    const name = String(row[key] ?? 'unknown').trim() || 'unknown';
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
  const days = Math.max(
    1,
    Math.ceil((endDate.getTime() - startDate.getTime()) / DAY_MS) + 1
  );
  const mode = days <= 31 ? 'day' : days <= 180 ? 'week' : 'month';
  const buckets = new Map<string, MerchantAnalyticsChartPoint>();

  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    const bucketStart = new Date(cursor);
    if (mode === 'week') {
      const day = bucketStart.getDay();
      bucketStart.setDate(bucketStart.getDate() - day);
    } else if (mode === 'month') {
      bucketStart.setDate(1);
    }
    bucketStart.setHours(0, 0, 0, 0);

    const key = bucketStart.toISOString();
    const day =
      mode === 'month'
        ? bucketStart.toLocaleDateString('en-US', { month: 'short' })
        : bucketStart.toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
          });

    if (!buckets.has(key)) {
      buckets.set(key, { day, orders: 0, profit: 0, revenue: 0, tax: 0 });
    }

    cursor.setDate(
      cursor.getDate() + (mode === 'month' ? 32 : mode === 'week' ? 7 : 1)
    );
    if (mode === 'month') {
      cursor.setDate(1);
    }
  }

  for (const row of rows) {
    const at = new Date(row.created_at);
    if (mode === 'week') {
      at.setDate(at.getDate() - at.getDay());
    } else if (mode === 'month') {
      at.setDate(1);
    }
    at.setHours(0, 0, 0, 0);
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
      at.setDate(at.getDate() - at.getDay());
    } else if (mode === 'month') {
      at.setDate(1);
    }
    at.setHours(0, 0, 0, 0);

    const bucket = buckets.get(at.toISOString());
    if (bucket) {
      const joinedProduct = Array.isArray(item.products)
        ? item.products[0]
        : item.products;
      const quantity = asNumber(item.quantity || 1);
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
    const quantity = asNumber(item.quantity || 1);
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
        name: item.name?.trim() || 'Product',
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
      .map(([name, value]) => ({ name, revenue: value, value }))
      .sort((left, right) => right.value - left.value),
    topBrand: topBrandEntry
      ? ({
          name: topBrandEntry[0],
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
  const customers = new Map<string, MerchantAnalyticsNamedValue>();
  for (const order of orders) {
    const name =
      order.customer_name?.trim() ||
      order.customer_email?.trim() ||
      'Guest customer';
    const current = customers.get(name) ?? { name, value: 0, revenue: 0 };
    current.value += 1;
    current.revenue = asNumber(current.revenue) + asNumber(order.total);
    customers.set(name, current);
  }

  return Array.from(customers.values()).sort((left, right) => {
    if (right.value !== left.value) return right.value - left.value;
    return asNumber(right.revenue) - asNumber(left.revenue);
  });
}

export async function getMerchantAnalyticsOverview(
  supabase: SupabaseClient,
  merchantId: string,
  startDate: Date,
  endDate: Date
): Promise<MerchantAnalyticsResponse> {
  const previousStart = new Date(
    startDate.getTime() - (endDate.getTime() - startDate.getTime()) - DAY_MS
  );
  const previousEnd = new Date(startDate.getTime() - 1);

  const [
    currentOrdersResult,
    previousOrdersResult,
    currentOrderItemsResult,
    previousOrderItemsResult,
    recentOrdersResult,
    blogPostsResult,
    activeOrdersResult,
  ] = await Promise.all([
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
  const currentCustomers = new Set(
    currentPaidOrders.map(
      (order) => order.customer_id ?? order.customer_email ?? order.id
    )
  ).size;
  const previousCustomers = new Set(
    previousPaidOrders.map(
      (order) => order.customer_id ?? order.customer_email ?? order.id
    )
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
            title: topPost.title,
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
      email: order.customer_email ?? '',
      id: order.id,
      name: order.customer_name ?? 'Customer',
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
      ltv: {
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
