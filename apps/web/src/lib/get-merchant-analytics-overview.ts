import type { MerchantAnalyticsResponse } from '@baci/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildChartData } from '@/lib/merchant-analytics-chart';
import { fetchMerchantAnalyticsData } from '@/lib/merchant-analytics-queries';
import { getComparisonAnalyticsRange } from '@/lib/merchant-analytics-range';
import {
  type AnalyticsOrderItemRow,
  type AnalyticsOrderRow,
  asNumber,
  type BlogPostRow,
  buildCustomerBreakdown,
  buildTopEntities,
  getCustomerAnalyticsKey,
  getPercentChange,
  groupBreakdown,
} from '@/lib/merchant-analytics-utils';
import { sanitizeText } from '@/lib/sanitize-core';

type RecentOrderRow = Pick<
  AnalyticsOrderRow,
  'created_at' | 'customer_email' | 'customer_name' | 'id' | 'total'
>;

export async function getMerchantAnalyticsOverview(
  supabase: SupabaseClient,
  merchantId: string,
  startDate: Date,
  endDate: Date,
  branchId?: string
): Promise<MerchantAnalyticsResponse> {
  const { previousEnd, previousStart } = getComparisonAnalyticsRange(
    startDate,
    endDate
  );

  const {
    activeOrdersResult,
    blogPostsResult,
    currentOrderItemsResult,
    currentOrdersResult,
    previousOrderItemsResult,
    previousOrdersResult,
    recentOrdersResult,
  } = await fetchMerchantAnalyticsData(
    supabase,
    merchantId,
    startDate,
    endDate,
    previousStart,
    previousEnd,
    branchId
  );

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
  const recentOrders = (recentOrdersResult.data ?? []) as RecentOrderRow[];
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
    recentSales: recentOrders.map((order) => ({
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
