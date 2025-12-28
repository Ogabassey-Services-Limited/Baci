/**
 * useCustomers Hook
 * Fetches customers with infinite scroll, search, and stats
 */

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useMerchant } from './useMerchant';

export interface Customer {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  phone: string | null;
  total_orders: number;
  total_spent: number;
  store_credit: number;
  loyalty_points: number;
  created_at: string;
  last_login_at: string | null;
}

interface CustomersPage {
  customers: Customer[];
  nextCursor: number | null;
  totalCount: number;
}

const PAGE_SIZE = 20;

async function fetchCustomers(
  merchantId: string,
  cursor: number = 0,
  filters?: { search?: string; sortBy?: 'recent' | 'orders' | 'spent' }
): Promise<CustomersPage> {
  let query = supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .eq('merchant_id', merchantId)
    .range(cursor, cursor + PAGE_SIZE - 1);

  // Apply sorting
  switch (filters?.sortBy) {
    case 'orders':
      query = query.order('total_orders', { ascending: false });
      break;
    case 'spent':
      query = query.order('total_spent', { ascending: false });
      break;
    default:
      query = query.order('created_at', { ascending: false });
  }

  if (filters?.search) {
    query = query.or(
      `full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
    );
  }

  const { data, error, count } = await query;

  if (error) throw new Error(error.message);

  const hasMore = (count ?? 0) > cursor + PAGE_SIZE;

  return {
    customers: data ?? [],
    nextCursor: hasMore ? cursor + PAGE_SIZE : null,
    totalCount: count ?? 0,
  };
}

export function useCustomers(filters?: { search?: string; sortBy?: 'recent' | 'orders' | 'spent' }) {
  const { merchant } = useMerchant();
  const merchantId = merchant?.id;

  return useInfiniteQuery({
    queryKey: ['customers', merchantId, filters],
    queryFn: ({ pageParam = 0 }) => fetchCustomers(merchantId!, pageParam, filters),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0,
    enabled: !!merchantId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useCustomer(customerId: string) {
  const { merchant } = useMerchant();

  return useQuery({
    queryKey: ['customer', customerId],
    queryFn: async () => {
      // Fetch customer
      const { data: customer, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .eq('merchant_id', merchant?.id)
        .single();

      if (error) throw new Error(error.message);

      // Fetch recent orders
      const { data: orders } = await supabase
        .from('orders')
        .select('id, order_number, total, shipping_status, created_at')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(5);

      return {
        ...customer,
        recent_orders: orders ?? [],
      };
    },
    enabled: !!customerId && !!merchant?.id,
  });
}

export function useCustomerStats() {
  const { merchant } = useMerchant();

  return useQuery({
    queryKey: ['customer-stats', merchant?.id],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Total customers
      const { count: total } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', merchant?.id);

      // New this month
      const { count: newThisMonth } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', merchant?.id)
        .gte('created_at', startOfMonth);

      // New this week
      const { count: newThisWeek } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', merchant?.id)
        .gte('created_at', startOfWeek);

      // Returning customers (more than 1 order)
      const { count: returning } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', merchant?.id)
        .gt('total_orders', 1);

      return {
        total: total ?? 0,
        newThisMonth: newThisMonth ?? 0,
        newThisWeek: newThisWeek ?? 0,
        returning: returning ?? 0,
        retentionRate: total && total > 0 ? Math.round(((returning ?? 0) / total) * 100) : 0,
      };
    },
    enabled: !!merchant?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
