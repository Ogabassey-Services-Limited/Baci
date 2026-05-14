import type { Order, OrderItem, ShippingStatus } from '@baci/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getBranchScopeKey } from '@/lib/branch-scope-query';
import { ORDER_COLUMNS } from '@/lib/orders';
import { sanitizeSearchQuery } from '@/lib/sanitize';
import { supabase } from '@/lib/supabase';
import { ALL_BRANCH_SCOPE, type BranchScope } from '@/schemas/branch';
import { useBranchScope } from '../useBranchScope';
import { useMerchant } from '../useMerchant';
import type { OrdersPage, OrderWithCount } from './order-types';

const PAGE_SIZE = 20;

export type { Order, OrderItem, OrdersPage, OrderWithCount, ShippingStatus };

export async function fetchOrders(
  merchantId: string,
  cursor: number = 0,
  filters?: {
    dateFilter?: string | { end: Date; start: Date } | null;
    search?: string;
    status?: ShippingStatus;
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
    } else if (
      typeof dateFilter === 'object' &&
      dateFilter.start &&
      dateFilter.end
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

  if (error) {
    throw new Error(error.message);
  }

  const hasMore = (count ?? 0) > cursor + PAGE_SIZE;
  const orders = (data ?? []).map((order) => ({
    ...order,
    item_count: order.order_items?.length ?? 0,
    order_items: undefined,
  })) as OrderWithCount[];

  return {
    nextCursor: hasMore ? cursor + PAGE_SIZE : null,
    orders,
    totalCount: count ?? 0,
  };
}

export function useOrders(
  status: ShippingStatus | 'all' = 'all',
  searchQuery: string = '',
  dateFilter: string | { end: Date; start: Date } | null = null
) {
  const { merchant } = useMerchant();
  const { scope } = useBranchScope();
  const merchantId = merchant?.id;
  const branchScopeKey = getBranchScopeKey(scope);

  const filters = {
    dateFilter: dateFilter === null ? undefined : dateFilter,
    search: searchQuery === '' ? undefined : searchQuery,
    status: status === 'all' ? undefined : status,
  };

  return useInfiniteQuery<OrdersPage, Error>({
    enabled: !!merchantId,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0,
    queryFn: ({ pageParam = 0 }) => {
      if (!merchantId) {
        throw new Error('Merchant ID is required');
      }

      return fetchOrders(merchantId, pageParam as number, filters, scope);
    },
    queryKey: ['orders', merchantId, filters, branchScopeKey],
    staleTime: 1000 * 60,
  });
}
