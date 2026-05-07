/**
 * useOrders Hook
 * Fetches orders with infinite scroll pagination
 * 2025 best practices: React Query v5, proper typing, optimistic updates
 */

// Import shared types from monorepo
import type {
  Order,
  OrderFulfillmentDetails,
  OrderItem,
  PaymentStatus,
  ShippingStatus,
} from '@baci/shared';
import type { InfiniteData } from '@tanstack/react-query';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { BASE_URL } from '@/lib/api-client';
import { getBranchScopeKey } from '@/lib/branch-scope-query';
import { ORDER_COLUMNS } from '@/lib/orders';
import { sanitizeSearchQuery } from '@/lib/sanitize';
import { supabase } from '@/lib/supabase';
import { getJoinedRecord } from '@/lib/supabase-utils';
import { ALL_BRANCH_SCOPE, type BranchScope } from '@/schemas/branch';
import { useBranchScope } from './useBranchScope';
import { useMerchant } from './useMerchant';

// Re-export for backward compatibility
export type { Order, OrderItem, PaymentStatus, ShippingStatus };

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

/** Shape returned by Supabase select on order_items with joined products */
interface OrderItemRow {
  id: string;
  has_assurance: boolean | null;
  product_id: string | null;
  variant_name: string | null;
  name: string | null;
  quantity: number;
  price: number;
  products:
    | {
        condition: string | null;
        images: string[] | null;
        name: string;
      }
    | Array<{
        condition: string | null;
        images: string[] | null;
        name: string;
      }>
    | null;
}

const PAGE_SIZE = 20;
const ORDER_STATUS_UPDATE_TIMEOUT_MS = 15000;

function parseResponsePayload(
  text: string
): Record<string, unknown> | string | null {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return text;
  }
}
export async function fetchOrders(
  merchantId: string,
  cursor: number = 0,
  filters?: {
    status?: ShippingStatus;
    search?: string;
    dateFilter?: string | { start: Date; end: Date } | null;
  },
  scope: BranchScope = ALL_BRANCH_SCOPE
): Promise<OrdersPage> {
  let query = supabase
    .from('orders')
    .select(`${ORDER_COLUMNS}, order_items(id)`, { count: 'exact' })
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .range(cursor, cursor + PAGE_SIZE - 1);

  if (scope.type === 'branch') {
    query = query.eq('branch_id', scope.branchId);
  }

  if (filters?.status) {
    query = query.eq('shipping_status', filters.status);
  }

  if (filters?.search) {
    const term = sanitizeSearchQuery(filters.search);
    if (term) {
      query = query.or(
        `order_number.ilike.%${term}%,customer_name.ilike.%${term}%,customer_email.ilike.%${term}%`
      );
    }
  }

  if (filters?.dateFilter) {
    const dateFilter = filters.dateFilter;

    if (dateFilter === 'Today') {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      query = query.gte('created_at', d.toISOString());
    } else if (dateFilter === 'Last 7 Days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      query = query.gte('created_at', d.toISOString());
    } else if (dateFilter === 'Last 30 Days') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      query = query.gte('created_at', d.toISOString());
    } else if (dateFilter === 'This Month') {
      const d = new Date();
      const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
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
  const orders = (data ?? []).map((order) => ({
    ...order,
    item_count: order.order_items?.length ?? 0,
    order_items: undefined, // Remove the nested array
  })) as OrderWithCount[];

  return {
    orders,
    nextCursor: hasMore ? cursor + PAGE_SIZE : null,
    totalCount: count ?? 0,
  };
}

async function updateOrderStatus(
  orderId: string,
  status: ShippingStatus,
  merchantId: string
): Promise<Order> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Unauthorized');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    ORDER_STATUS_UPDATE_TIMEOUT_MS
  );

  try {
    const response = await fetch(`${BASE_URL}/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        shipping_status: status,
        merchant_id: merchantId,
      }),
      signal: controller.signal,
    });
    const responseText = await response.text();
    const payload = parseResponsePayload(responseText);

    if (!response.ok) {
      const errorMessage =
        payload &&
        typeof payload === 'object' &&
        typeof payload.error === 'string'
          ? payload.error
          : responseText ||
            `Request failed: ${response.status} ${response.statusText}`;
      throw new Error(errorMessage);
    }

    if (
      !payload ||
      typeof payload !== 'object' ||
      !('order' in payload) ||
      !payload.order
    ) {
      throw new Error('Failed to update order status');
    }

    return payload.order as Order;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        'Request timed out. Please check your connection and try again.'
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function useOrders(
  status: ShippingStatus | 'all' = 'all',
  searchQuery: string = '',
  dateFilter: string | { start: Date; end: Date } | null = null
) {
  const { merchant } = useMerchant();
  const { scope } = useBranchScope();
  const merchantId = merchant?.id;
  const branchScopeKey = getBranchScopeKey(scope);

  // Construct filters object from new parameters
  const filters = {
    status: status === 'all' ? undefined : status,
    search: searchQuery === '' ? undefined : searchQuery,
    dateFilter: dateFilter === null ? undefined : dateFilter,
  };

  return useInfiniteQuery({
    queryKey: ['orders', merchantId, filters, branchScopeKey],
    queryFn: ({ pageParam = 0 }) => {
      if (!merchantId) {
        throw new Error('Merchant ID is required');
      }

      return fetchOrders(merchantId, pageParam, filters, scope);
    },
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
    mutationKey: ['updateOrderStatus'],
    mutationFn: ({
      orderId,
      status,
    }: {
      orderId: string;
      status: ShippingStatus;
    }) => {
      if (!merchant?.id) throw new Error('Merchant ID is required');
      return updateOrderStatus(orderId, status, merchant.id);
    },
    onMutate: async ({ orderId, status }) => {
      if (!merchant?.id)
        return { previousOrders: [], previousOrder: undefined };
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['orders', merchant.id] });

      // Snapshot previous value
      const previousOrders = queryClient.getQueriesData<OrdersPage>({
        queryKey: ['orders', merchant.id],
      });

      // Optimistically update list
      // Optimistically update list - Match ALL order queries
      queryClient.setQueriesData<InfiniteData<OrdersPage>>(
        { queryKey: ['orders', merchant.id] },
        (old) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              orders: page.orders.map((order) =>
                order.id === orderId
                  ? { ...order, shipping_status: status }
                  : order
              ),
            })),
          };
        }
      );

      // KEY FIX: Optimistically update the single order detail view
      const previousOrder = queryClient.getQueryData(['order', orderId]);
      queryClient.setQueryData(['order', orderId], (old: Order | undefined) => {
        if (!old) return old;
        return { ...old, shipping_status: status };
      });

      return { previousOrders, previousOrder };
    },
    onError: (_err, vars, context) => {
      // Rollback on error
      if (context?.previousOrders) {
        context.previousOrders.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
        // Note: onSettled already invalidates orders query, no need to do it here
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
        .select(ORDER_COLUMNS)
        .eq('id', orderId)
        .eq('merchant_id', merchant?.id)
        .single();

      if (error) throw new Error(error.message);

      // Fetch order items, transactions, and virtual account in parallel
      const [
        { data: items, error: itemsError },
        { data: transactions, error: transactionsError },
        { data: virtualAccount, error: virtualAccountError },
      ] = await Promise.all([
        supabase
          .from('order_items')
          .select(
            'id, product_id, has_assurance, variant_name, name, quantity, price, products(name, images, condition)'
          )
          .eq('order_id', orderId),
        supabase
          .from('transactions')
          .select('amount')
          .eq('order_id', orderId)
          .in('status', ['success', 'completed']),
        supabase
          .from('order_payment_accounts')
          .select('account_number, bank_name, account_name')
          .eq('order_id', orderId)
          .maybeSingle(),
      ]);

      if (itemsError) {
        throw new Error(itemsError.message);
      }

      if (transactionsError) {
        throw new Error(transactionsError.message);
      }

      if (virtualAccountError) {
        throw new Error(virtualAccountError.message);
      }

      // Fetch recorded_by user info + staff virtual terminal if staff-created
      let recordedByName: string | null = null;
      let staffTerminal: {
        account_number: string;
        bank_name: string;
        account_name: string;
      } | null = null;

      if (order.recorded_by_user_id) {
        // Get staff profile name
        const { data: recUser } = await supabase
          .from('profiles')
          .select('display_name, full_name')
          .eq('id', order.recorded_by_user_id)
          .single();

        const fullName = recUser?.display_name || recUser?.full_name;
        if (fullName) {
          recordedByName = fullName.split(' ')[0];
        }

        // Look up staff member → their virtual terminal bank account
        const { data: staffMember } = await supabase
          .from('staff_members')
          .select('id')
          .eq('user_id', order.recorded_by_user_id)
          .eq('merchant_id', merchant?.id)
          .eq('status', 'active')
          .maybeSingle();

        if (staffMember) {
          const { data: terminal } = await supabase
            .from('virtual_terminals')
            .select('account_number, account_name, bank')
            .eq('staff_id', staffMember.id)
            .eq('active', true)
            .maybeSingle();

          if (terminal?.account_number) {
            staffTerminal = {
              account_number: terminal.account_number,
              bank_name: terminal.bank,
              account_name: terminal.account_name,
            };
          }
        }
      }

      const transTotal =
        transactions?.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0;
      const amountPaid = transTotal + (Number(order.wallet_amount_used) || 0);
      const balance = Math.max(0, (Number(order.total) || 0) - amountPaid);

      const orderWithMeta = order as typeof order & {
        fulfillment_details?: OrderFulfillmentDetails | null;
      };

      return {
        ...order,
        amount_paid: amountPaid,
        balance: balance,
        virtual_account: virtualAccount || null,
        staff_terminal: staffTerminal,
        recorded_by_name: recordedByName,
        fulfillment_details: orderWithMeta.fulfillment_details ?? null,
        items: (items as OrderItemRow[] | null)?.map((item) => {
          const product = getJoinedRecord(item.products);
          const itemName = item.name ?? product?.name ?? 'Unnamed item';
          const imageUrl = product?.images?.[0];

          return {
            id: item.id,
            product_id: item.product_id ?? `custom-${item.id}`,
            has_assurance: item.has_assurance ?? undefined,
            name: itemName,
            product_name: itemName,
            condition: product?.condition ?? undefined,
            variant_name: item.variant_name ?? undefined,
            quantity: item.quantity,
            price: item.price,
            image_url: imageUrl,
          };
        }),
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
    mutationKey: ['shipOnCredit'],
    mutationFn: async ({
      orderId,
      creditNotes,
    }: {
      orderId: string;
      creditNotes?: string;
    }) => {
      // Get the current session for auth token
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${BASE_URL}/api/orders/${orderId}/ship-on-credit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ credit_notes: creditNotes }),
        }
      );
      if (!response.ok) {
        let errorMsg = `Request failed: ${response.status} ${response.statusText}`;
        try {
          const errorBody = await response.json();
          if (errorBody.error) errorMsg = errorBody.error;
        } catch {
          /* not JSON */
        }
        throw new Error(errorMsg);
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
    mutationKey: ['sendReminder'],
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
        `${BASE_URL}/api/orders/${orderId}/reminder`,
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
    mutationKey: ['recordPayment'],
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
          `${BASE_URL}/api/orders/${orderId}/record-payment`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            // Δ-36 (A3): omit blank/whitespace optional fields rather
            // than wiring them as empty strings. The API schema also
            // normalizes ""/"   "/undefined → undefined (defense in
            // depth), but trimming client-side keeps the wire clean
            // and means a present-but-blank field never leaves the
            // device.
            body: JSON.stringify({
              amount,
              payment_method: paymentMethod,
              reference: reference?.trim() || undefined,
              notes: notes?.trim() || undefined,
            }),
            signal: controller.signal,
          }
        );
        clearTimeout(timeoutId);

        if (!response.ok) {
          let errorMsg = `Request failed: ${response.status} ${response.statusText}`;
          try {
            const errorBody = await response.json();
            if (errorBody.error) errorMsg = errorBody.error;
          } catch {
            /* not JSON */
          }
          throw new Error(errorMsg);
        }
        return response.json();
      } catch (error: unknown) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
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

// Generate DVA hook - creates a Paystack virtual bank account for an order
export function useGenerateDva() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['generateDva'],
    mutationFn: async ({ orderId }: { orderId: string }) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      try {
        const response = await fetch(
          `${BASE_URL}/api/orders/${orderId}/generate-dva`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          let errorMsg = `Request failed: ${response.status} ${response.statusText}`;
          try {
            const errorBody = await response.json();
            if (errorBody.error) errorMsg = errorBody.error;
          } catch {
            // Response wasn't JSON, use default message
          }
          throw new Error(errorMsg);
        }
        return response.json() as Promise<{
          success: boolean;
          virtualAccount: {
            account_number: string;
            bank_name: string;
            account_name: string;
          };
          existing: boolean;
        }>;
      } catch (error: unknown) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(
            'DVA generation timed out. Paystack may be slow — try again.'
          );
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    onSuccess: (_data, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
    },
  });
}
