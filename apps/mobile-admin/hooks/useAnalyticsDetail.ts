/**
 * useAnalyticsDetail Hook
 * Fetches time-bucketed analytics data for a specific metric
 * Supports comparison with previous period
 */

import { useQuery } from '@tanstack/react-query';
import { getPreviousAnalyticsDateRange } from '@/lib/analytics-period';
import { supabase } from '@/lib/supabase';
import { useMerchant } from './useMerchant';

/** Shape returned by the order_items join: products!inner(cost_price) */
interface JoinedProduct {
  cost_price: number | null;
}

/** Shape returned by the order_items join: orders!inner(id, merchant_id, payment_status, created_at) */
interface JoinedOrder {
  id: string;
  merchant_id: string;
  payment_status: string;
  created_at: string;
}

/** A single order_items row with its joined relations */
interface OrderItemWithJoins {
  quantity: number | null;
  price: number | null;
  products: JoinedProduct | JoinedProduct[] | null;
  orders: JoinedOrder | JoinedOrder[] | null;
}

interface AnalyticsOrder {
  id: string;
  total: number | null;
  tax_amount: number | null;
  payment_status: string | null;
  created_at: string;
}

export type MetricType = 'revenue' | 'sales' | 'aov' | 'profits' | 'vat';
export type Granularity = 'hourly' | 'weekday' | 'month';

export interface TimeSeriesDataPoint {
  label: string;
  value: number;
  secondaryValue?: number; // For metrics that show two values (e.g., revenue + profit)
  count?: number; // Number of orders (for calculating averages)
}

export interface AnalyticsDetailData {
  metric: MetricType;
  granularity: Granularity;
  rangeLabel: string;
  total: number;
  comparisonTotal?: number;
  percentChange?: number;
  data: TimeSeriesDataPoint[];
  comparisonData?: TimeSeriesDataPoint[];
  bestPeriod: { label: string; value: number } | null;
  worstPeriod: { label: string; value: number } | null;
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from(
  { length: 24 },
  (_, i) => `${i.toString().padStart(2, '0')}:00`
);

interface UseAnalyticsDetailOptions {
  metric: MetricType;
  granularity: Granularity;
  startDate: string;
  endDate: string;
  filterLabel: string;
  includeComparison?: boolean;
}

const getJoinedRecord = <T>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
};

export function useAnalyticsDetail({
  endDate,
  filterLabel,
  metric,
  granularity,
  startDate,
  includeComparison = false,
}: UseAnalyticsDetailOptions) {
  const { merchant } = useMerchant();

  return useQuery<AnalyticsDetailData>({
    queryKey: [
      'analytics-detail',
      merchant?.id,
      metric,
      granularity,
      startDate,
      endDate,
      includeComparison,
    ],
    queryFn: async () => {
      if (!merchant?.id) throw new Error('No merchant found');

      const startDateValue = new Date(startDate);
      const endDateValue = new Date(endDate);

      if (
        Number.isNaN(startDateValue.getTime()) ||
        Number.isNaN(endDateValue.getTime())
      ) {
        throw new Error(
          `Invalid analytics date range: startDate=${startDate}, endDate=${endDate}`
        );
      }

      // Callers sometimes pass a date-only string or a midnight timestamp for
      // `endDate`. Normalize that to the inclusive end of the same day so the
      // final calendar day in the selected range is not silently excluded.
      if (
        endDateValue.getUTCHours() === 0 &&
        endDateValue.getUTCMinutes() === 0 &&
        endDateValue.getUTCSeconds() === 0 &&
        endDateValue.getUTCMilliseconds() === 0
      ) {
        endDateValue.setUTCHours(23, 59, 59, 999);
      }

      // Fetch orders and order items concurrently
      const [
        { data: orders, error: ordersError },
        { data: orderItems, error: orderItemsError },
      ] = await Promise.all([
        supabase
          .from('orders')
          .select('id, total, tax_amount, payment_status, created_at')
          .eq('merchant_id', merchant.id)
          .eq('payment_status', 'paid')
          .gte('created_at', startDateValue.toISOString())
          .lte('created_at', endDateValue.toISOString()),
        supabase
          .from('order_items')
          .select(`
                    quantity,
                    price,
                    products!inner(cost_price),
                    orders!inner(id, merchant_id, payment_status, created_at)
                `)
          .eq('orders.merchant_id', merchant.id)
          .eq('orders.payment_status', 'paid')
          .gte('orders.created_at', startDateValue.toISOString())
          .lte('orders.created_at', endDateValue.toISOString()),
      ]);

      if (ordersError) {
        throw new Error(`Failed to fetch orders: ${ordersError.message}`);
      }

      if (orderItemsError) {
        throw new Error(
          `Failed to fetch order items: ${orderItemsError.message}`
        );
      }

      const typedOrderItems =
        (orderItems as unknown as OrderItemWithJoins[] | null) ?? [];

      // Process data based on granularity
      const buckets = getBuckets(granularity);
      const data: TimeSeriesDataPoint[] = buckets.map((label) => ({
        label,
        value: 0,
        secondaryValue: 0,
        count: 0,
      }));

      // Aggregate orders
      orders?.forEach((order) => {
        const date = new Date(order.created_at);
        const bucketIndex = getBucketIndex(date, granularity);
        if (bucketIndex >= 0 && bucketIndex < data.length) {
          data[bucketIndex].count = (data[bucketIndex].count || 0) + 1;

          switch (metric) {
            case 'revenue':
              data[bucketIndex].value += order.total || 0;
              break;
            case 'sales':
              data[bucketIndex].value += 1;
              break;
            case 'vat':
              data[bucketIndex].value += order.tax_amount || 0;
              break;
            case 'aov':
              // We'll calculate AOV after aggregation
              data[bucketIndex].value += order.total || 0;
              break;
          }
        }
      });

      // Calculate profits per bucket
      if (metric === 'profits' || metric === 'revenue') {
        typedOrderItems.forEach((item) => {
          const order = getJoinedRecord(item.orders);
          const product = getJoinedRecord(item.products);
          if (!order || !product) return;

          const date = new Date(order.created_at);
          const bucketIndex = getBucketIndex(date, granularity);

          if (bucketIndex >= 0 && bucketIndex < data.length) {
            const revenue = (item.price || 0) * (item.quantity || 1);
            const cost = (product.cost_price || 0) * (item.quantity || 1);
            const profit = revenue - cost;

            if (metric === 'profits') {
              data[bucketIndex].value += profit;
              data[bucketIndex].secondaryValue =
                (data[bucketIndex].secondaryValue || 0) + revenue;
            } else if (metric === 'revenue') {
              data[bucketIndex].secondaryValue =
                (data[bucketIndex].secondaryValue || 0) + profit;
            }
          }
        });
      }

      // Calculate AOV (divide accumulated revenue by count)
      if (metric === 'aov') {
        data.forEach((bucket) => {
          if (bucket.count && bucket.count > 0) {
            bucket.value /= bucket.count;
          }
        });
      }

      // Calculate totals
      let total = 0;
      if (metric === 'aov') {
        const totalRevenue = data.reduce(
          (sum, d) => sum + d.value * (d.count || 0),
          0
        );
        const totalCount = data.reduce((sum, d) => sum + (d.count || 0), 0);
        total = totalCount > 0 ? totalRevenue / totalCount : 0;
      } else {
        total = data.reduce((sum, d) => sum + d.value, 0);
      }

      // Find best and worst periods
      const nonZeroData = data.filter((d) => d.value > 0);
      const bestPeriod =
        nonZeroData.length > 0
          ? nonZeroData.reduce((best, d) => (d.value > best.value ? d : best))
          : null;
      const worstPeriod =
        nonZeroData.length > 0
          ? nonZeroData.reduce((worst, d) =>
              d.value < worst.value ? d : worst
            )
          : null;

      // Fetch comparison data if requested
      let comparisonData: TimeSeriesDataPoint[] | undefined;
      let comparisonTotal: number | undefined;
      let percentChange: number | undefined;

      if (includeComparison) {
        const previousRange = getPreviousAnalyticsDateRange({
          endDate: endDateValue,
          startDate: startDateValue,
        });
        const prevStartDate = previousRange.startDate;
        const prevEndDate = previousRange.endDate;

        const prevOrdersQuery = supabase
          .from('orders')
          .select('id, total, tax_amount, payment_status, created_at')
          .eq('merchant_id', merchant.id)
          .eq('payment_status', 'paid')
          .gte('created_at', prevStartDate.toISOString())
          .lte('created_at', prevEndDate.toISOString());

        let prevOrderItems: OrderItemWithJoins[] = [];
        let prevOrders: AnalyticsOrder[] | null = null;

        if (metric === 'profits') {
          const [
            { data: profitsOrders, error: prevOrdersError },
            { data: profitsOrderItems, error: prevOrderItemsError },
          ] = await Promise.all([
            prevOrdersQuery,
            supabase
              .from('order_items')
              .select(`
                  quantity,
                  price,
                  products!inner(cost_price),
                  orders!inner(id, merchant_id, payment_status, created_at)
              `)
              .eq('orders.merchant_id', merchant.id)
              .eq('orders.payment_status', 'paid')
              .gte('orders.created_at', prevStartDate.toISOString())
              .lte('orders.created_at', prevEndDate.toISOString()),
          ]);

          if (prevOrdersError) {
            throw new Error(
              `Failed to fetch comparison orders: ${prevOrdersError.message}`
            );
          }

          if (prevOrderItemsError) {
            throw new Error(
              `Failed to fetch comparison order items: ${prevOrderItemsError.message}`
            );
          }

          prevOrders = profitsOrders;
          prevOrderItems = profitsOrderItems ?? [];
        } else {
          const { data: nonProfitOrders, error: prevOrdersError } =
            await prevOrdersQuery;

          if (prevOrdersError) {
            throw new Error(
              `Failed to fetch comparison orders: ${prevOrdersError.message}`
            );
          }

          prevOrders = nonProfitOrders;
        }

        comparisonData = buckets.map((label) => ({
          label,
          value: 0,
          secondaryValue: 0,
          count: 0,
        }));

        prevOrders?.forEach((order) => {
          const date = new Date(order.created_at);
          const bucketIndex = getBucketIndex(date, granularity);

          if (
            comparisonData &&
            bucketIndex >= 0 &&
            bucketIndex < comparisonData.length
          ) {
            comparisonData[bucketIndex].count =
              (comparisonData[bucketIndex].count || 0) + 1;

            switch (metric) {
              case 'revenue':
              case 'aov':
                comparisonData[bucketIndex].value += order.total || 0;
                break;
              case 'sales':
                comparisonData[bucketIndex].value += 1;
                break;
              case 'vat':
                comparisonData[bucketIndex].value += order.tax_amount || 0;
                break;
            }
          }
        });

        // Calculate profits for comparison period
        if (metric === 'profits' && comparisonData) {
          const comparisonBuckets = comparisonData;

          prevOrderItems.forEach((item) => {
            const order = getJoinedRecord(item.orders);
            const product = getJoinedRecord(item.products);
            if (!order || !product) return;

            const date = new Date(order.created_at);
            const bucketIndex = getBucketIndex(date, granularity);

            if (bucketIndex >= 0 && bucketIndex < comparisonBuckets.length) {
              const revenue = (item.price || 0) * (item.quantity || 1);
              const cost = (product.cost_price || 0) * (item.quantity || 1);
              comparisonBuckets[bucketIndex].value += revenue - cost;
              comparisonBuckets[bucketIndex].secondaryValue =
                (comparisonBuckets[bucketIndex].secondaryValue || 0) + revenue;
            }
          });
        }

        if (metric === 'aov') {
          comparisonData.forEach((bucket) => {
            if (bucket.count && bucket.count > 0) {
              bucket.value /= bucket.count;
            }
          });
          const prevTotalRevenue = comparisonData.reduce(
            (sum, d) => sum + d.value * (d.count || 0),
            0
          );
          const prevTotalCount = comparisonData.reduce(
            (sum, d) => sum + (d.count || 0),
            0
          );
          comparisonTotal =
            prevTotalCount > 0 ? prevTotalRevenue / prevTotalCount : 0;
        } else {
          comparisonTotal = comparisonData.reduce((sum, d) => sum + d.value, 0);
        }

        percentChange =
          comparisonTotal > 0
            ? ((total - comparisonTotal) / comparisonTotal) * 100
            : total > 0
              ? 100
              : 0;
      }

      return {
        metric,
        granularity,
        rangeLabel: filterLabel,
        total,
        comparisonTotal,
        percentChange,
        data,
        comparisonData,
        bestPeriod: bestPeriod
          ? { label: bestPeriod.label, value: bestPeriod.value }
          : null,
        worstPeriod: worstPeriod
          ? { label: worstPeriod.label, value: worstPeriod.value }
          : null,
      };
    },
    enabled: !!merchant?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

function getBuckets(granularity: Granularity): string[] {
  switch (granularity) {
    case 'hourly':
      return HOURS;
    case 'weekday':
      return WEEKDAYS;
    case 'month':
      return MONTHS;
  }
}

function getBucketIndex(date: Date, granularity: Granularity): number {
  switch (granularity) {
    case 'hourly':
      return date.getHours();
    case 'weekday':
      return date.getDay();
    case 'month':
      return date.getMonth();
  }
}

// Metric display configuration
export const METRIC_CONFIG: Record<
  MetricType,
  {
    title: string;
    columns: {
      key: string;
      label: string;
      format: 'currency' | 'number' | 'percent';
    }[];
  }
> = {
  revenue: {
    title: 'Revenue',
    columns: [
      { key: 'value', label: 'Revenue', format: 'currency' },
      { key: 'count', label: 'Sales', format: 'number' },
      { key: 'secondaryValue', label: 'Profits', format: 'currency' },
    ],
  },
  sales: {
    title: 'Sales',
    columns: [{ key: 'value', label: 'Orders', format: 'number' }],
  },
  aov: {
    title: 'Average Order Value',
    columns: [
      { key: 'value', label: 'AOV', format: 'currency' },
      { key: 'count', label: 'Orders', format: 'number' },
    ],
  },
  profits: {
    title: 'Profits',
    columns: [
      { key: 'secondaryValue', label: 'Revenue', format: 'currency' },
      { key: 'value', label: 'Profits', format: 'currency' },
    ],
  },
  vat: {
    title: 'VAT Due',
    columns: [{ key: 'value', label: 'VAT', format: 'currency' }],
  },
};
