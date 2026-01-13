/**
 * useOrders Hook
 * Fetches orders with infinite scroll pagination
 * 2025 best practices: React Query v5, proper typing, optimistic updates
 */

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  useQuery,
} from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useMerchant } from './useMerchant';
// Import shared types from monorepo
import type {
  ShippingStatus,
  PaymentStatus,
  Order,
  OrderItem,
} from '@baci/shared';

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
  filters?: {
    status?: ShippingStatus;
    search?: string;
    dateFilter?: string | { start: Date; end: Date } | null;
  }
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

  if (filters?.dateFilter) {
    const now = new Date();
    const dateFilter = filters.dateFilter;

    if (dateFilter === 'Today') {
      const start = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      query = query.gte('created_at', start);
    } else if (dateFilter === 'Last 7 Days') {
      const start = new Date(now.setDate(now.getDate() - 7)).toISOString();
      query = query.gte('created_at', start);
    } else if (dateFilter === 'Last 30 Days') {
      const start = new Date(now.setDate(now.getDate() - 30)).toISOString();
      query = query.gte('created_at', start);
    } else if (dateFilter === 'This Month') {
      const start = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      ).toISOString();
      query = query.gte('created_at', start);
    } else if (
      typeof dateFilter === 'object' &&
      dateFilter?.start &&
      dateFilter?.end
    ) {
      const start = new Date(dateFilter.start);
      start.setHours(0, 0, 0, 0);

      const end = new Date(dateFilter.end);
      end.setHours(23, 59, 59, 999);

      query = query
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());
    }
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

export function useOrders(
  status: ShippingStatus | 'all' = 'all',
  searchQuery: string = '',
  dateFilter: string | { start: Date; end: Date } | null = null
) {
  const { merchant } = useMerchant();
  const merchantId = merchant?.id;

  // Construct filters object from new parameters
  const filters = {
    status: status === 'all' ? undefined : status,
    search: searchQuery === '' ? undefined : searchQuery,
    dateFilter: dateFilter === null ? undefined : dateFilter,
  };

  return useInfiniteQuery({
    queryKey: ['orders', merchantId, filters, dateFilter], // Include dateFilter in queryKey
    queryFn: ({ pageParam = 0 }) =>
      fetchOrders(merchantId!, pageParam, filters),
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
    mutationFn: ({
      orderId,
      status,
    }: {
      orderId: string;
      status: ShippingStatus;
    }) => updateOrderStatus(orderId, status),
    onMutate: async ({ orderId, status }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['orders', merchant?.id] });

      // Snapshot previous value
      const previousOrders = queryClient.getQueryData(['orders', merchant?.id]);

      // Optimistically update list
      queryClient.setQueryData(['orders', merchant?.id], (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: OrdersPage) => ({
            ...page,
            orders: page.orders.map((order: Order) =>
              order.id === orderId
                ? { ...order, shipping_status: status }
                : order
            ),
          })),
        };
      });

      // KEY FIX: Optimistically update the single order detail view
      const previousOrder = queryClient.getQueryData(['order', orderId]);
      queryClient.setQueryData(['order', orderId], (old: any) => {
        if (!old) return old;
        return { ...old, shipping_status: status };
      });

      return { previousOrders, previousOrder };
    },
    onError: (_err, vars, context) => {
      // Rollback on error
      if (context?.previousOrders) {
        queryClient.setQueryData(
          ['orders', merchant?.id],
          context.previousOrders
        );
      }
      if (context?.previousOrder) {
        queryClient.setQueryData(
          ['order', vars.orderId],
          context.previousOrder
        );
      }
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: ['orders', merchant?.id] });
      queryClient.invalidateQueries({
        queryKey: ['dashboard-stats', merchant?.id],
      });
      queryClient.invalidateQueries({
        queryKey: ['order-counts', merchant?.id],
      });
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

      // Fetch recorded_by user info if this is a staff-created order
      let recordedByName: string | null = null;
      if (order.recorded_by_user_id) {
        const { data: recUser } = await supabase
          .from('profiles')
          .select('display_name, full_name')
          .eq('id', order.recorded_by_user_id)
          .single();

        // Use display_name or full_name, extract first name
        const fullName = recUser?.display_name || recUser?.full_name;
        if (fullName) {
          recordedByName = fullName.split(' ')[0];
        }
      }

      const transTotal =
        transactions?.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0;
      const amountPaid = transTotal + (Number(order.wallet_amount_used) || 0);
      const balance = Math.max(0, (Number(order.total) || 0) - amountPaid);

      return {
        ...order,
        amount_paid: amountPaid,
        balance: balance,
        virtual_account: virtualAccount || null,
        recorded_by_name: recordedByName,
        items: items?.map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          name: item.name || item.products?.name,
          product_name: item.name || item.products?.name,
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
    mutationFn: async ({
      orderId,
      creditNotes,
    }: {
      orderId: string;
      creditNotes?: string;
    }) => {
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
          throw new Error(
            `Request failed: ${response.status} ${response.statusText}`
          );
        }
      }
      return response.json();
    },
    onSuccess: (_data, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders', merchant?.id] });
      queryClient.invalidateQueries({
        queryKey: ['order-counts', merchant?.id],
      });
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
      // Get the current session for auth
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL || ''}/api/orders/${orderId}/reminder`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ channel, message }),
        }
      );
      if (!response.ok) {
        // Safely try to parse error response
        try {
          const error = await response.json();
          throw new Error(error.error || 'Failed to send reminder');
        } catch {
          throw new Error(
            `Request failed: ${response.status} ${response.statusText}`
          );
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
      // Get the current session for auth token
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Add timeout to prevent indefinite hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout

      try {
        const response = await fetch(
          `${process.env.EXPO_PUBLIC_API_URL || ''}/api/orders/${orderId}/record-payment`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              amount,
              payment_method: paymentMethod,
              reference,
              notes,
            }),
            signal: controller.signal,
          }
        );
        clearTimeout(timeoutId);

        if (!response.ok) {
          // Safely try to parse error response
          try {
            const error = await response.json();
            throw new Error(error.error || 'Failed to record payment');
          } catch {
            // Response was not JSON (could be HTML error page)
            throw new Error(
              `Request failed: ${response.status} ${response.statusText}`
            );
          }
        }
        return response.json();
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error(
            'Request timed out. Please check your connection and try again.'
          );
        }
        throw error;
      }
    },
    onSuccess: (_data, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders', merchant?.id] });
      queryClient.invalidateQueries({
        queryKey: ['order-counts', merchant?.id],
      });
      queryClient.invalidateQueries({
        queryKey: ['dashboard-stats', merchant?.id],
      });
    },
  });
}
