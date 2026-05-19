import { useCallback, useEffect, useMemo, useState } from 'react';
import { createLogger } from '@/lib/logger';
import {
  buildOrderListFilters,
  matchesOrderListFilter,
  type OrderListFilterKey,
} from '@/lib/order-list-filters';
import { filterOrdersBySearchQuery } from '@/lib/order-list-search';
import { supabase } from '@/lib/supabase';

const log = createLogger('OrdersList');

export interface OrderListOrder {
  id: string;
  order_number: string;
  shipping_status: string;
  subtotal: number;
  shipping_fee: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  payment_status: string;
  created_at: string;
  items_count: number;
  items: Array<{
    id: string;
    product_name: string;
    quantity: number;
    price: number;
  }>;
}

type UseOrdersListControllerArgs = {
  customerId: string | null | undefined;
  onReconnect: (handler: () => void) => () => void;
};

type OrdersRow = {
  id: string;
  order_number: string;
  shipping_status: string;
  subtotal: number;
  shipping_fee: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  payment_status: string;
  created_at: string;
  order_items?: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
  }> | null;
};

export function useOrdersListController({
  customerId,
  onReconnect,
}: UseOrdersListControllerArgs) {
  const [orders, setOrders] = useState<OrderListOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] =
    useState<OrderListFilterKey>('all');

  const fetchOrders = useCallback(async () => {
    if (!customerId) {
      setOrders([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          shipping_status,
          subtotal,
          shipping_fee,
          discount_amount,
          tax_amount,
          total,
          payment_status,
          created_at,
          order_items (
            id,
            name,
            quantity,
            price
          )
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      const formattedOrders: OrderListOrder[] = ((data ?? []) as OrdersRow[]).map(
        (order) => ({
          created_at: order.created_at,
          discount_amount: order.discount_amount,
          id: order.id,
          items: (order.order_items ?? []).map((item) => ({
            id: item.id,
            price: item.price,
            product_name: item.name,
            quantity: item.quantity,
          })),
          items_count: (order.order_items ?? []).length,
          order_number: order.order_number,
          payment_status: order.payment_status,
          shipping_fee: order.shipping_fee,
          shipping_status: order.shipping_status,
          subtotal: order.subtotal,
          tax_amount: order.tax_amount,
          total: order.total,
        })
      );

      setOrders(formattedOrders);
      setError(null);
    } catch (fetchError) {
      log.error('Error fetching orders:', fetchError);
      setError('Failed to load orders');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [customerId]);

  useEffect(() => {
    setIsLoading(true);
    void fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    return onReconnect(() => {
      void fetchOrders();
    });
  }, [fetchOrders, onReconnect]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    void fetchOrders();
  }, [fetchOrders]);

  const orderFilters = useMemo(() => buildOrderListFilters(orders), [orders]);

  const filteredOrders = useMemo(
    () =>
      filterOrdersBySearchQuery(
        orders.filter((order) => matchesOrderListFilter(order, selectedFilter)),
        searchQuery
      ),
    [orders, searchQuery, selectedFilter]
  );

  return {
    error,
    fetchOrders,
    filteredOrders,
    handleRefresh,
    isLoading,
    isRefreshing,
    orderFilters,
    orders,
    searchQuery,
    selectedFilter,
    setSearchQuery,
    setSelectedFilter,
  };
}
