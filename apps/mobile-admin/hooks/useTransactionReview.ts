import { useQuery } from '@tanstack/react-query';
import { useMerchant } from '@/hooks/useMerchant';
import { supabase } from '@/lib/supabase';

interface TransactionReviewRange {
  endDate?: Date;
  startDate?: Date;
}

interface TransactionOrderRow {
  created_at: string;
  customer_name: string | null;
  id: string;
  order_items: Array<{
    id: string;
    name: string | null;
    price: number | null;
    product_id: string | null;
    products:
      | {
          cost_price: number | null;
        }
      | Array<{
          cost_price: number | null;
        }>
      | null;
    quantity: number | null;
  }> | null;
  order_number: string | null;
  payment_method: string | null;
  total: number | null;
}

export interface TransactionReviewItem {
  costPrice: number | null;
  id: string;
  name: string;
  productId: string | null;
  profit: number | null;
  quantity: number;
  revenue: number;
}

export interface TransactionReviewOrder {
  createdAt: string;
  customerName: string;
  estimatedProfit: number;
  id: string;
  items: TransactionReviewItem[];
  missingCostCount: number;
  orderNumber: string;
  paymentMethod: string;
  total: number;
}

function getJoinedProduct(
  value:
    | { cost_price: number | null }
    | Array<{ cost_price: number | null }>
    | null
) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function useTransactionReview(range?: TransactionReviewRange) {
  const { merchant } = useMerchant();
  const startDateIso = range?.startDate
    ? new Date(
        Date.UTC(
          range.startDate.getUTCFullYear(),
          range.startDate.getUTCMonth(),
          range.startDate.getUTCDate(),
          0,
          0,
          0,
          0
        )
      ).toISOString()
    : undefined;
  const endDateIso = range?.endDate
    ? new Date(
        Date.UTC(
          range.endDate.getUTCFullYear(),
          range.endDate.getUTCMonth(),
          range.endDate.getUTCDate(),
          23,
          59,
          59,
          999
        )
      ).toISOString()
    : undefined;

  return useQuery<TransactionReviewOrder[]>({
    queryKey: ['transaction-review', merchant?.id, startDateIso, endDateIso],
    queryFn: async () => {
      if (!merchant?.id) {
        throw new Error('Merchant context is not ready');
      }

      let query = supabase
        .from('orders')
        .select(
          'id, order_number, created_at, customer_name, payment_method, total, order_items(id, product_id, name, price, quantity, products(cost_price))'
        )
        .eq('merchant_id', merchant.id)
        .eq('payment_status', 'paid')
        .order('created_at', { ascending: false });

      if (startDateIso) {
        query = query.gte('created_at', startDateIso);
      }

      if (endDateIso) {
        query = query.lte('created_at', endDateIso);
      }

      const { data, error } = await query.limit(40);

      if (error) {
        throw new Error(error.message);
      }

      return ((data ?? []) as TransactionOrderRow[]).map((order) => {
        const items = (order.order_items ?? []).map((item) => {
          const product = getJoinedProduct(item.products);
          const quantity = Number(item.quantity ?? 1);
          const revenue = Number(item.price ?? 0) * quantity;
          const costPrice =
            product?.cost_price == null ? null : Number(product.cost_price);
          return {
            costPrice,
            id: item.id,
            name: item.name ?? 'Product',
            productId: item.product_id,
            profit: costPrice == null ? null : revenue - costPrice * quantity,
            quantity,
            revenue,
          };
        });

        return {
          createdAt: order.created_at,
          customerName: order.customer_name ?? 'Customer',
          estimatedProfit: items.reduce(
            (sum, item) => sum + (item.profit ?? 0),
            0
          ),
          id: order.id,
          items,
          missingCostCount: items.filter((item) => item.costPrice == null)
            .length,
          orderNumber: order.order_number ?? order.id.slice(0, 8),
          paymentMethod: order.payment_method ?? 'unknown',
          total: Number(order.total ?? 0),
        };
      });
    },
    enabled: Boolean(merchant?.id),
    staleTime: 1000 * 60,
  });
}
