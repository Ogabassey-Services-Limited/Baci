import {
  buildCustomerAddressLine,
  buildCustomerRecordNameFields,
  CUSTOMER_ADMIN_COLUMNS,
} from '@baci/shared';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { sanitizeEmail, sanitizePhone } from '@/lib/sanitize';
import { supabase } from '@/lib/supabase';
import { fetchCustomerStats, fetchCustomers } from './customers-data';
import { useMerchant } from './useMerchant';

export type { Customer } from './customers-data';

const DUPLICATE_CUSTOMER_MESSAGE =
  'Customer with this email or phone already exists';
const DUPLICATE_CUSTOMER_CONSTRAINTS = [
  'customers_merchant_id_email_key',
  'customers_merchant_email_unique',
  'idx_customers_merchant_email',
  'customers_merchant_phone_unique',
] as const;

function escapeIlikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function isDuplicateCustomerConstraintError(
  error: { message?: string | null } | null
): boolean {
  const message = error?.message ?? '';

  return DUPLICATE_CUSTOMER_CONSTRAINTS.some((constraint) =>
    message.includes(constraint)
  );
}

export function useCustomers(filters?: {
  customerType?: 'individual' | 'company';
  search?: string;
  sortBy?: 'recent' | 'orders' | 'spent' | 'alpha';
}) {
  const { merchant } = useMerchant();
  const merchantId = merchant?.id;

  return useInfiniteQuery({
    queryKey: ['customers', merchantId, filters],
    queryFn: ({ pageParam = 0 }) => {
      if (!merchantId) throw new Error('No merchant selected');
      return fetchCustomers(merchantId, pageParam, filters);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0,
    enabled: !!merchantId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useCustomer(customerId: string) {
  const { merchant } = useMerchant();
  const merchantId = merchant?.id;

  return useQuery({
    queryKey: ['customer', customerId, merchantId],
    queryFn: async () => {
      if (!merchantId) throw new Error('No merchant selected');

      const [customerRes, ordersRes] = await Promise.all([
        supabase
          .from('customers')
          .select(CUSTOMER_ADMIN_COLUMNS)
          .eq('id', customerId)
          .eq('merchant_id', merchantId)
          .single(),
        supabase
          .from('orders')
          .select('id, order_number, total, shipping_status, created_at')
          .eq('merchant_id', merchantId)
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
    enabled: !!customerId && !!merchantId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useCustomerStats() {
  const { merchant } = useMerchant();

  return useQuery({
    queryKey: ['customer-stats', merchant?.id],
    queryFn: () => {
      if (!merchant?.id) throw new Error('No merchant selected');
      return fetchCustomerStats(merchant.id);
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
      company_name?: string;
      customer_type?: 'individual' | 'company';
      first_name: string;
      last_name: string;
      email?: string;
      phone?: string;
      address?: string;
      city?: string;
      state?: string;
      zip_code?: string;
      country?: string;
      country_code?: string;
      latitude?: number;
      longitude?: number;
    }) => {
      if (!merchant?.id) throw new Error('No merchant selected');

      const normalizedEmail = newCustomer.email
        ? sanitizeEmail(newCustomer.email)
        : '';
      const normalizedPhone = newCustomer.phone
        ? sanitizePhone(newCustomer.phone)
        : '';

      if (normalizedPhone) {
        const { data: existingPhoneCustomer, error: phoneLookupError } =
          await supabase
            .from('customers')
            .select('id')
            .eq('merchant_id', merchant.id)
            .is('deleted_at', null)
            .eq('phone', normalizedPhone)
            .limit(1);

        if (phoneLookupError) throw new Error(phoneLookupError.message);
        if (existingPhoneCustomer?.[0])
          throw new Error(DUPLICATE_CUSTOMER_MESSAGE);
      }

      if (normalizedEmail) {
        const { data: existingEmailCustomer, error: emailLookupError } =
          await supabase
            .from('customers')
            .select('id')
            .eq('merchant_id', merchant.id)
            .is('deleted_at', null)
            .ilike('email', escapeIlikePattern(normalizedEmail))
            .limit(1);

        if (emailLookupError) throw new Error(emailLookupError.message);
        if (existingEmailCustomer?.[0])
          throw new Error(DUPLICATE_CUSTOMER_MESSAGE);
      }

      const nameFields = buildCustomerRecordNameFields({
        company_name: newCustomer.company_name,
        customer_type: newCustomer.customer_type ?? 'individual',
        first_name: newCustomer.first_name,
        last_name: newCustomer.last_name,
        email: normalizedEmail || undefined,
      });
      const address =
        newCustomer.address?.trim() ||
        buildCustomerAddressLine(
          newCustomer.city,
          newCustomer.state,
          newCustomer.zip_code
        );

      const { data, error } = await supabase
        .from('customers')
        .insert({
          merchant_id: merchant.id,
          ...nameFields,
          email: normalizedEmail || null,
          phone: normalizedPhone || null,
          address,
          city: newCustomer.city?.trim() || null,
          state: newCustomer.state?.trim() || null,
          zip_code: newCustomer.zip_code?.trim() || null,
          country: newCustomer.country?.trim() || null,
          country_code: newCustomer.country_code?.trim() || null,
          latitude:
            typeof newCustomer.latitude === 'number' &&
            Number.isFinite(newCustomer.latitude)
              ? newCustomer.latitude
              : null,
          longitude:
            typeof newCustomer.longitude === 'number' &&
            Number.isFinite(newCustomer.longitude)
              ? newCustomer.longitude
              : null,
          store_credit: 0,
          total_orders: 0,
          total_spent: 0,
          loyalty_points: 0,
        })
        .select(CUSTOMER_ADMIN_COLUMNS)
        .single();

      if (error) {
        if (isDuplicateCustomerConstraintError(error)) {
          throw new Error(DUPLICATE_CUSTOMER_MESSAGE);
        }
        throw new Error(error.message);
      }
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
      customer_type: 'individual' | 'company' | null;
      company_name?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      email: string;
      phone?: string | null;
      address?: string | null;
    }) => {
      if (!merchant?.id) throw new Error('No merchant selected');

      const { id, ...customerData } = updates;
      // Company-aware: recompute company_name/customer_type/full_name together so
      // a company customer's name can be edited on mobile too (mirrors the web
      // PATCH route). Callers must pass the stored customer_type so an untouched
      // company isn't flipped to individual.
      const nameFields = buildCustomerRecordNameFields(customerData);

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
