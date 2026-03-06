import { useInfiniteQuery } from '@tanstack/react-query';
import { ORDER_COLUMNS } from '@/constants/order-columns';
import { sanitizeSearchQuery } from '@/lib/sanitize';
import { supabase } from '@/lib/supabase';
import type { OrdersPage, OrderWithCount, ShippingStatus } from './order-types';
import { useMerchant } from './useMerchant';

export type {
  Order,
  OrderItem,
  OrdersPage,
  OrderWithCount,
  PaymentStatus,
  ShippingStatus,
} from './order-types';
export { useOrder } from './useOrder';
export {
  useGenerateDva,
  useRecordPayment,
  useSendReminder,
  useShipOnCredit,
  useUpdateOrderStatus,
} from './useOrderMutations';

export const PAGE_SIZE = 20;

async function fetchOrders(
  merchantId: string,
  cursor: number = 0,
  filters?: {
    status?: ShippingStatus;
    search?: string;
    dateFilter?: string | { start: Date; end: Date };
  }
): Promise<OrdersPage> {
  let query = supabase
    .from('orders')
    .select(`${ORDER_COLUMNS}, order_items(id)`, { count: 'exact' })
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .range(cursor, cursor + PAGE_SIZE - 1);

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
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      query = query.gte('created_at', date.toISOString());
    } else if (dateFilter === 'Last 7 Days') {
      const date = new Date();
      date.setDate(date.getDate() - 7);
      query = query.gte('created_at', date.toISOString());
    } else if (dateFilter === 'Last 30 Days') {
      const date = new Date();
      date.setDate(date.getDate() - 30);
      query = query.gte('created_at', date.toISOString());
    } else if (dateFilter === 'This Month') {
      const date = new Date();
      const start = new Date(
        date.getFullYear(),
        date.getMonth(),
        1
      ).toISOString();
      query = query.gte('created_at', start);
    } else if (typeof dateFilter === 'object') {
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

  if (error) {
    throw new Error(error.message);
  }

  const orders = (data ?? []).map((order) => ({
    ...order,
    item_count: order.order_items?.length ?? 0,
    order_items: undefined,
  })) as OrderWithCount[];
  const hasMore = (count ?? 0) > cursor + PAGE_SIZE;

  return {
    orders,
    nextCursor: hasMore ? cursor + PAGE_SIZE : null,
    totalCount: count ?? 0,
  };
}

export function useOrders(
  status: ShippingStatus | 'all' = 'all',
  searchQuery: string = '',
  dateFilter: string | { start: Date; end: Date } | null = null
) {
  const { merchant } = useMerchant();
  const merchantId = merchant?.id;
  const filters = {
    status: status === 'all' ? undefined : status,
    search: searchQuery === '' ? undefined : searchQuery,
    dateFilter: dateFilter ?? undefined,
  };

  return useInfiniteQuery({
    queryKey: ['orders', merchantId, filters],
    queryFn: ({ pageParam = 0 }) =>
      fetchOrders(merchantId!, pageParam, filters),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0,
    enabled: !!merchantId,
    staleTime: 1000 * 60,
  });
}
