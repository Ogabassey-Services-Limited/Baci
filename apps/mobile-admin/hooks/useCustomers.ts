/**
 * useCustomers Hook
 * Fetches customers with infinite scroll, search, and stats
 */

import {
  buildCustomerAddressLine,
  buildCustomerNameFields,
  buildCustomerSearchFilter,
  CUSTOMER_ADMIN_COLUMNS,
} from '@baci/shared';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { sanitizeSearchQuery } from '@/lib/sanitize';
import { supabase } from '@/lib/supabase';
import { useMerchant } from './useMerchant';

export interface Customer {
  id: string;
  merchant_id: string;
  full_name: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  address: string | null;
  total_orders: number;
  total_spent: number;
  store_credit: number;
  loyalty_points: number;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  deleted_at: string | null;
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
  filters?: {
    search?: string;
    sortBy?: 'recent' | 'orders' | 'spent' | 'alpha';
  }
): Promise<CustomersPage> {
  let query = supabase
    .from('customers')
    .select(CUSTOMER_ADMIN_COLUMNS, { count: 'exact' })
    .eq('merchant_id', merchantId)
    .is('deleted_at', null) // Exclude soft-deleted customers
    .range(cursor, cursor + PAGE_SIZE - 1);

  // Apply sorting
  switch (filters?.sortBy) {
    case 'orders':
      query = query.order('total_orders', { ascending: false });
      break;
    case 'spent':
      query = query.order('total_spent', { ascending: false });
      break;
    case 'alpha':
      query = query.order('full_name', { ascending: true });
      break;
    default:
      query = query.order('created_at', { ascending: false });
  }

  if (filters?.search) {
    const term = sanitizeSearchQuery(filters.search);
    if (term) {
      query = query.or(buildCustomerSearchFilter(term));
    }
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

export function useCustomers(filters?: {
  search?: string;
  sortBy?: 'recent' | 'orders' | 'spent' | 'alpha';
}) {
  const { merchant } = useMerchant();
  const merchantId = merchant?.id;

  return useInfiniteQuery({
    queryKey: ['customers', merchantId, filters],
    queryFn: ({ pageParam = 0 }) =>
      fetchCustomers(merchantId!, pageParam, filters),
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
      // PERFORMANCE: Use Promise.all to fetch customer details and recent orders concurrently
      const [customerRes, ordersRes] = await Promise.all([
        // Fetch customer
        supabase
          .from('customers')
          .select(CUSTOMER_ADMIN_COLUMNS)
          .eq('id', customerId)
          .eq('merchant_id', merchant?.id)
          .single(),
        // Fetch recent orders
        supabase
          .from('orders')
          .select('id, order_number, total, shipping_status, created_at')
          .eq('merchant_id', merchant?.id)
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      if (customerRes.error) throw new Error(customerRes.error.message);
      if (ordersRes.error) throw new Error(ordersRes.error.message);

      return {
        ...customerRes.data,
        recent_orders: ordersRes.data ?? [],
      };
    },
    enabled: !!customerId && !!merchant?.id,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useCustomerStats() {
  const { merchant } = useMerchant();

  return useQuery({
    queryKey: ['customer-stats', merchant?.id],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      ).toISOString();
      const startOfWeek = new Date(
        now.getTime() - 7 * 24 * 60 * 60 * 1000
      ).toISOString();

      // PERFORMANCE: Use Promise.all to run independent count queries concurrently
      const [totalRes, newThisMonthRes, newThisWeekRes, returningRes] =
        await Promise.all([
          // Total customers (excluding deleted)
          supabase
            .from('customers')
            .select('id', { count: 'exact', head: true })
            .eq('merchant_id', merchant?.id)
            .is('deleted_at', null),
          // New this month
          supabase
            .from('customers')
            .select('id', { count: 'exact', head: true })
            .eq('merchant_id', merchant?.id)
            .is('deleted_at', null)
            .gte('created_at', startOfMonth),
          // New this week
          supabase
            .from('customers')
            .select('id', { count: 'exact', head: true })
            .eq('merchant_id', merchant?.id)
            .is('deleted_at', null)
            .gte('created_at', startOfWeek),
          // Returning customers (more than 1 order)
          supabase
            .from('customers')
            .select('id', { count: 'exact', head: true })
            .eq('merchant_id', merchant?.id)
            .is('deleted_at', null)
            .gt('total_orders', 1),
        ]);

      if (totalRes.error) throw new Error(totalRes.error.message);
      if (newThisMonthRes.error) {
        throw new Error(newThisMonthRes.error.message);
      }
      if (newThisWeekRes.error) throw new Error(newThisWeekRes.error.message);
      if (returningRes.error) throw new Error(returningRes.error.message);

      const { count: total } = totalRes;
      const { count: newThisMonth } = newThisMonthRes;
      const { count: newThisWeek } = newThisWeekRes;
      const { count: returning } = returningRes;

      return {
        total: total ?? 0,
        newThisMonth: newThisMonth ?? 0,
        newThisWeek: newThisWeek ?? 0,
        returning: returning ?? 0,
        retentionRate:
          total && total > 0 ? Math.round(((returning ?? 0) / total) * 100) : 0,
      };
    },
    enabled: !!merchant?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useCreateCustomer() {
  const { merchant } = useMerchant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['createCustomer'],
    mutationFn: async (newCustomer: {
      first_name: string;
      last_name: string;
      email?: string;
      phone?: string;
      address?: string;
      city?: string;
      state?: string;
      zip_code?: string;
    }) => {
      if (!merchant?.id) throw new Error('No merchant selected');

      // Check if customer already exists by email or phone
      if (newCustomer.email || newCustomer.phone) {
        let query = supabase
          .from('customers')
          .select('id')
          .eq('merchant_id', merchant.id)
          .is('deleted_at', null);

        const conditions = [];
        if (newCustomer.email) conditions.push(`email.eq.${newCustomer.email}`);
        if (newCustomer.phone) conditions.push(`phone.eq.${newCustomer.phone}`);

        if (conditions.length > 0) {
          query = query.or(conditions.join(','));
          const { data: existing } = await query.maybeSingle();
          if (existing)
            throw new Error('Customer with this email or phone already exists');
        }
      }

      const nameFields = buildCustomerNameFields({
        first_name: newCustomer.first_name,
        last_name: newCustomer.last_name,
        email: newCustomer.email,
      });
      const address = buildCustomerAddressLine(
        newCustomer.address,
        newCustomer.city,
        newCustomer.state,
        newCustomer.zip_code
      );

      const { data, error } = await supabase
        .from('customers')
        .insert({
          merchant_id: merchant.id,
          ...nameFields,
          email: newCustomer.email || null,
          phone: newCustomer.phone || null,
          address,
          store_credit: 0,
          total_orders: 0,
          total_spent: 0,
          loyalty_points: 0,
        })
        .select(CUSTOMER_ADMIN_COLUMNS)
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-stats'] });
    },
  });
}

export function useUpdateCustomer() {
  const { merchant } = useMerchant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['updateCustomer'],
    mutationFn: async (updates: {
      id: string;
      first_name?: string | null;
      last_name?: string | null;
      email: string;
      phone?: string | null;
      address?: string | null;
    }) => {
      if (!merchant?.id) throw new Error('No merchant selected');

      const { id, ...customerData } = updates;
      const nameFields = buildCustomerNameFields(customerData);

      const { data, error } = await supabase
        .from('customers')
        .update({
          ...customerData,
          ...nameFields,
        })
        .eq('id', id)
        .eq('merchant_id', merchant.id)
        .select(CUSTOMER_ADMIN_COLUMNS)
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', variables.id] });
    },
  });
}

export function useDeleteCustomer() {
  const { merchant } = useMerchant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['deleteCustomer'],
    mutationFn: async (customerId: string) => {
      if (!merchant?.id) throw new Error('No merchant selected');

      // Check if customer has orders
      const { count: orderCount } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', merchant.id)
        .eq('customer_id', customerId);

      // Soft delete by setting deleted_at timestamp
      const { error } = await supabase
        .from('customers')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', customerId)
        .eq('merchant_id', merchant.id);

      if (error) throw new Error(error.message);

      return {
        success: true,
        hadOrders: (orderCount ?? 0) > 0,
        orderCount: orderCount ?? 0,
      };
    },
    onSuccess: (_, customerId) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer-stats'] });
    },
  });
}
