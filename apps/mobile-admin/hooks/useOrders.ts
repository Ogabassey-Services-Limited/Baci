/**
 * useOrders Hook
 * Fetches orders with infinite scroll pagination
 * 2025 best practices: React Query v5, proper typing, optimistic updates
 */

import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useMerchant } from './useMerchant';
// Import shared types from monorepo
import type { ShippingStatus, PaymentStatus, Order, OrderItem } from '@baci/shared';

// Re-export for backward compatibility
export type { ShippingStatus, PaymentStatus, Order, OrderItem };

// Extended Order type for mobile app (includes item_count)
export interface OrderWithCount extends Order {
  item_count?: number;
  items?: OrderItem[];
}

interface OrdersPage {
  orders: Order[];
  nextCursor: number | null;
  totalCount: number;
}

const PAGE_SIZE = 20;

async function fetchOrders(
  merchantId: string,
  cursor: number = 0,
  filters?: { status?: ShippingStatus; search?: string }
): Promise<OrdersPage> {
  let query = supabase
    .from('orders')
    .select('*, order_items(id)', { count: 'exact' })
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .range(cursor, cursor + PAGE_SIZE - 1);

  if (filters?.status) {
    query = query.eq('shipping_status', filters.status);
  }

  if (filters?.search) {
    query = query.or(
      `order_number.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%,customer_email.ilike.%${filters.search}%`
    );
  }

  const { data, error, count } = await query;

  if (error) throw new Error(error.message);

  const hasMore = (count ?? 0) > cursor + PAGE_SIZE;

  // Map orders with item_count
  const orders = (data ?? []).map((order: any) => ({
    ...order,
    item_count: order.order_items?.length ?? 0,
    order_items: undefined, // Remove the nested array
  }));

  return {
    orders,
    nextCursor: hasMore ? cursor + PAGE_SIZE : null,
    totalCount: count ?? 0,
  };
}

async function updateOrderStatus(
  orderId: string,
  status: ShippingStatus
): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .update({ shipping_status: status, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .select();

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error('Order not found');
  return data[0];
}

export function useOrders(filters?: { status?: ShippingStatus; search?: string }) {
  const { merchant } = useMerchant();
  const merchantId = merchant?.id;

  return useInfiniteQuery({
    queryKey: ['orders', merchantId, filters],
    queryFn: ({ pageParam = 0 }) => fetchOrders(merchantId!, pageParam, filters),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0,
    enabled: !!merchantId,
    staleTime: 1000 * 60, // 1 minute
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();

  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: ShippingStatus }) =>
      updateOrderStatus(orderId, status),
    onMutate: async ({ orderId, status }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['orders', merchant?.id] });

      // Snapshot previous value
      const previousOrders = queryClient.getQueryData(['orders', merchant?.id]);

      // Optimistically update
      queryClient.setQueryData(['orders', merchant?.id], (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: OrdersPage) => ({
            ...page,
            orders: page.orders.map((order: Order) =>
              order.id === orderId ? { ...order, shipping_status: status } : order
            ),
          })),
        };
      });

      return { previousOrders };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previousOrders) {
        queryClient.setQueryData(['orders', merchant?.id], context.previousOrders);
      }
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: ['orders', merchant?.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats', merchant?.id] });
      queryClient.invalidateQueries({ queryKey: ['order-counts', merchant?.id] });
    },
  });
}

export function useOrder(orderId: string) {
  const { merchant } = useMerchant();

  return useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      const { data: order, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .eq('merchant_id', merchant?.id)
        .single();

      if (error) throw new Error(error.message);

      // Fetch order items
      const { data: items } = await supabase
        .from('order_items')
        .select('*, products(name, images)')
        .eq('order_id', orderId);

      // Fetch transactions
      const { data: transactions } = await supabase
        .from('transactions')
        .select('amount')
        .eq('order_id', orderId)
        .eq('status', 'success');

      // Fetch virtual account if exists
      const { data: virtualAccount } = await supabase
        .from('order_payment_accounts')
        .select('account_number, bank_name, account_name')
        .eq('order_id', orderId)
        .single();

      const transTotal = transactions?.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0;
      const amountPaid = transTotal + (Number(order.wallet_amount_used) || 0);
      const balance = Math.max(0, (Number(order.total) || 0) - amountPaid);

      return {
        ...order,
        amount_paid: amountPaid,
        balance: balance,
        virtual_account: virtualAccount || null,
        items: items?.map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.products?.name ?? item.product_name,
          quantity: item.quantity,
          price: item.price,
          image_url: item.products?.images?.[0],
        })),
      };
    },
    enabled: !!orderId && !!merchant?.id,
  });
}

// Ship on Credit hook - for confirming unpaid orders
export function useShipOnCredit() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();

  return useMutation({
    mutationFn: async ({ orderId, creditNotes }: { orderId: string; creditNotes?: string }) => {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL || ''}/api/orders/${orderId}/ship-on-credit`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credit_notes: creditNotes }),
        }
      );
      if (!response.ok) {
        // Safely try to parse error response
        try {
          const error = await response.json();
          throw new Error(error.error || 'Failed to ship on credit');
        } catch {
          throw new Error(`Request failed: ${response.status} ${response.statusText}`);
        }
      }
      return response.json();
    },
    onSuccess: (_data, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders', merchant?.id] });
      queryClient.invalidateQueries({ queryKey: ['order-counts', merchant?.id] });
    },
  });
}

// Send Reminder hook - for sending payment reminders
export function useSendReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      channel = 'email',
      message = '',
    }: {
      orderId: string;
      channel?: 'email' | 'sms' | 'whatsapp';
      message?: string;
    }) => {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL || ''}/api/orders/${orderId}/reminder`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel, message }),
        }
      );
      if (!response.ok) {
        // Safely try to parse error response
        try {
          const error = await response.json();
          throw new Error(error.error || 'Failed to send reminder');
        } catch {
          throw new Error(`Request failed: ${response.status} ${response.statusText}`);
        }
      }
      return response.json();
    },
    onSuccess: (_data, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
    },
  });
}
// Record Payment hook - for manual payments
export function useRecordPayment() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();

  return useMutation({
    mutationFn: async ({
      orderId,
      amount,
      paymentMethod,
      reference,
      notes,
    }: {
      orderId: string;
      amount: number;
      paymentMethod: string;
      reference?: string;
      notes?: string;
    }) => {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL || ''}/api/orders/${orderId}/record-payment`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, payment_method: paymentMethod, reference, notes }),
        }
      );
      if (!response.ok) {
        // Safely try to parse error response
        try {
          const error = await response.json();
          throw new Error(error.error || 'Failed to record payment');
        } catch {
          // Response was not JSON (could be HTML error page)
          throw new Error(`Request failed: ${response.status} ${response.statusText}`);
        }
      }
      return response.json();
    },
    onSuccess: (_data, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders', merchant?.id] });
      queryClient.invalidateQueries({ queryKey: ['order-counts', merchant?.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats', merchant?.id] });
    },
  });
}
