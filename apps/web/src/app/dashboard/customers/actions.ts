'use server';

import {
  buildCustomerRecordNameFields,
  buildCustomerSearchFilter,
  CUSTOMER_ADMIN_COLUMNS,
  extractOrderDeliveryAddress,
  WEB_ORDER_WITH_ITEMS_QUERY,
} from '@baci/shared';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { ensurePermission } from '@/lib/merchant-server';
import {
  sanitizeEmail,
  sanitizePhone,
  sanitizeText,
} from '@/lib/sanitize-core';
import { createClient } from '@/lib/supabase/server';

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

export interface CreateCustomerData {
  customer_type?: 'individual' | 'company';
  company_name?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  store_credit?: number;
}

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

  const isCompany = formData.customer_type === 'company';
  const firstName = formData.first_name
    ? sanitizeText(formData.first_name, 100)
    : null;
  const lastName = formData.last_name
    ? sanitizeText(formData.last_name, 100)
    : null;
  const companyName = formData.company_name
    ? sanitizeText(formData.company_name, 200)
    : null;
  const email = formData.email ? sanitizeEmail(formData.email) : null;
  const phone = formData.phone ? sanitizePhone(formData.phone) : null;
  const address = formData.address ? sanitizeText(formData.address, 500) : null;

  if (isCompany && !companyName) {
    throw new Error('Company name is required');
  }

  const nameFields = buildCustomerRecordNameFields({
    company_name: companyName,
    customer_type: formData.customer_type,
    first_name: firstName,
    last_name: lastName,
    email,
  });

  const { data: customer, error } = await supabase
    .from('customers')
    .insert({
      merchant_id: authorizedMerchantId,
      ...nameFields,
      email,
      phone,
      address,
      store_credit: formData.store_credit ?? 0,
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
