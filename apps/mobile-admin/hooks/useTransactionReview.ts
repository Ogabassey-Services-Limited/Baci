import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useMerchant } from './useMerchant';

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
  costPrice: number;
  id: string;
  name: string;
  productId: string | null;
  profit: number;
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

export function useTransactionReview() {
  const { merchant } = useMerchant();

  return useQuery<TransactionReviewOrder[]>({
    queryKey: ['transaction-review', merchant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(
          'id, order_number, created_at, customer_name, payment_method, total, order_items(id, product_id, name, price, quantity, products(cost_price))'
        )
        .eq('merchant_id', merchant?.id)
        .eq('payment_status', 'paid')
        .order('created_at', { ascending: false })
        .limit(40);

      if (error) {
        throw new Error(error.message);
      }

      return ((data ?? []) as TransactionOrderRow[]).map((order) => {
        const items = (order.order_items ?? []).map((item) => {
          const product = getJoinedProduct(item.products);
          const quantity = Number(item.quantity ?? 1);
          const revenue = Number(item.price ?? 0) * quantity;
          const costPrice = Number(product?.cost_price ?? 0);
          return {
            costPrice,
            id: item.id,
            name: item.name ?? 'Product',
            productId: item.product_id,
            profit: revenue - costPrice * quantity,
            quantity,
            revenue,
          };
        });

        return {
          createdAt: order.created_at,
          customerName: order.customer_name ?? 'Customer',
          estimatedProfit: items.reduce((sum, item) => sum + item.profit, 0),
          id: order.id,
          items,
          missingCostCount: items.filter((item) => item.costPrice <= 0).length,
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

export function useUpdateTransactionCostPrice() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();

  return useMutation({
    mutationFn: async ({
      costPrice,
      productId,
    }: {
      costPrice: number;
      productId: string;
    }) => {
      if (!merchant?.id) {
        throw new Error('Merchant context is not ready');
      }

      const { error } = await supabase
        .from('products')
        .update({
          cost_price: costPrice,
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId)
        .eq('merchant_id', merchant.id);

      if (error) {
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaction-review'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-overview'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-detail'] });
      queryClient.invalidateQueries({ queryKey: ['top-selling-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
