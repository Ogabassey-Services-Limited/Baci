'use server';

import {
  buildCustomerAddressLine,
  buildCustomerRecordNameFields,
  buildCustomerSearchFilter,
  CUSTOMER_ADMIN_COLUMNS,
  extractOrderDeliveryAddress,
  WEB_ORDER_WITH_ITEMS_QUERY,
} from '@baci/shared';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import type { z } from 'zod';
import { ensurePermission } from '@/lib/merchant-server';
import { createClient } from '@/lib/supabase/server';
import { createCustomerSchema, formatZodErrors } from '@/schemas/customers';

export interface Customer {
  id: string;
  merchant_id: string;
  customer_type: 'individual' | 'company';
  company_name: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
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

export type CreateCustomerData = z.input<typeof createCustomerSchema>;

async function resolveCustomerMerchantId(
  action: 'view' | 'create'
): Promise<string | null> {
  try {
    const { merchant } = await ensurePermission('customers', action);
    return merchant.id;
  } catch {
    return null;
  }
}

export async function getCustomers(
  merchantId: string,
  search?: string
): Promise<Customer[]> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return [];
  }

  const authorizedMerchantId = await resolveCustomerMerchantId('view');

  if (!authorizedMerchantId || merchantId !== authorizedMerchantId) {
    return [];
  }

  let query = supabase
    .from('customers')
    .select(CUSTOMER_ADMIN_COLUMNS)
    .eq('merchant_id', authorizedMerchantId)
    .order('created_at', { ascending: false });

  if (search?.trim()) {
    query = query.or(buildCustomerSearchFilter(search));
  }

  const { data: customers, error } = await query;

  if (error) {
    console.error('Error fetching customers:', error);
    return [];
  }

  return customers || [];
}

export async function createCustomer(formData: CreateCustomerData) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  const authorizedMerchantId = await resolveCustomerMerchantId('create');
  if (!authorizedMerchantId) {
    throw new Error('Unauthorized');
  }

  // Reuse the same Zod schema as the /api/customers route so both entry points
  // enforce identical rules (sanitization, email format, and the company-name
  // superRefine) instead of drifting apart with a hand-rolled check.
  const parseResult = createCustomerSchema.safeParse(formData);
  if (!parseResult.success) {
    const details = formatZodErrors(parseResult.error);
    const firstError =
      Object.values(details)[0]?.[0] ?? 'Invalid customer details';
    throw new Error(firstError);
  }
  const body = parseResult.data;

  const nameFields = buildCustomerRecordNameFields({
    ...body,
    customer_type: body.customer_type ?? 'individual',
  });
  const address = buildCustomerAddressLine(body.address, body.city, body.state);

  const { data: customer, error } = await supabase
    .from('customers')
    .insert({
      merchant_id: authorizedMerchantId,
      ...nameFields,
      email: body.email || null,
      phone: body.phone || null,
      address,
      store_credit: body.store_credit ?? 0,
    })
    .select(CUSTOMER_ADMIN_COLUMNS)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/dashboard/customers');
  return customer;
}

export async function getCustomer(
  customerId: string
): Promise<Customer | null> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const authorizedMerchantId = await resolveCustomerMerchantId('view');
  if (!authorizedMerchantId) {
    return null;
  }

  const { data: customer, error } = await supabase
    .from('customers')
    .select(CUSTOMER_ADMIN_COLUMNS)
    .eq('id', customerId)
    .eq('merchant_id', authorizedMerchantId)
    .single();

  if (error || !customer) {
    console.error('Error fetching customer:', error);
    return null;
  }

  return customer;
}

interface OrderItemData {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

export interface CustomerOrder {
  id: string;
  created_at: string;
  order_number: string;
  total: number;
  shipping_status: string;
  payment_method: string;
  shipping_address: string;
  items: OrderItemData[];
}

export async function getCustomerOrders(
  customerId: string
): Promise<CustomerOrder[]> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return [];
  }

  const authorizedMerchantId = await resolveCustomerMerchantId('view');
  if (!authorizedMerchantId) {
    return [];
  }

  const { data: customer } = await supabase
    .from('customers')
    .select('id, merchant_id, email')
    .eq('id', customerId)
    .eq('merchant_id', authorizedMerchantId)
    .single();

  if (!customer) return [];

  let orderQuery = supabase
    .from('orders')
    .select(WEB_ORDER_WITH_ITEMS_QUERY)
    .eq('merchant_id', customer.merchant_id)
    .order('created_at', { ascending: false });

  if (customer.email) {
    orderQuery = orderQuery.or(
      `customer_id.eq.${customerId},and(customer_email.eq.${customer.email},customer_id.is.null)`
    );
  } else {
    orderQuery = orderQuery.eq('customer_id', customerId);
  }

  const { data: orders, error } = await orderQuery;

  if (error) {
    console.error('Error fetching customer orders:', error);
    return [];
  }

  return (orders || []).map((order) => ({
    id: order.id,
    created_at: order.created_at,
    order_number: order.order_number,
    total: Number(order.total),
    shipping_status: order.shipping_status,
    payment_method: order.payment_method || 'N/A',
    shipping_address:
      extractOrderDeliveryAddress(order.shipping_address) || 'N/A',
    items: (order.order_items || []).map((item: OrderItemData) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
    })),
  }));
}
