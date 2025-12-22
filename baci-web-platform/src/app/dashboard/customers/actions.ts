'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import {
  sanitizeEmail,
  sanitizeLikePattern,
  sanitizePhone,
  sanitizeSearchQuery,
  sanitizeText,
} from '@/lib/sanitize-core';
import { createClient } from '@/lib/supabase/server';

export interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string | null;
  total_orders: number;
  total_spent: number;
  store_credit: number;
  created_at: string;
}

export interface CreateCustomerData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
}

export async function getCustomers(
  merchantId: string,
  search?: string
): Promise<Customer[]> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  let query = supabase
    .from('customers')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false });

  if (search?.trim()) {
    const sanitizedPattern = sanitizeLikePattern(sanitizeSearchQuery(search));
    query = query.or(
      `first_name.ilike.%${sanitizedPattern}%,last_name.ilike.%${sanitizedPattern}%,email.ilike.%${sanitizedPattern}%,phone.ilike.%${sanitizedPattern}%`
    );
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

  // Authenticate user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Get merchant_id
  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!merchant) {
    throw new Error('Merchant not found');
  }

  // Sanitize input
  const { first_name, last_name, email, phone, address } = formData;

  const { data: customer, error } = await supabase
    .from('customers')
    .insert({
      first_name: first_name ? sanitizeText(first_name, 100) : null,
      last_name: last_name ? sanitizeText(last_name, 100) : null,
      email: email ? sanitizeEmail(email) : null,
      phone: phone ? sanitizePhone(phone) : null,
      address: address ? sanitizeText(address, 500) : null,
      merchant_id: merchant.id,
    })
    .select()
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

  // Authenticate user to prevent IDOR
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Get merchant_id for authorization
  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!merchant) {
    return null;
  }

  // Fetch customer with merchant verification
  const { data: customer, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .eq('merchant_id', merchant.id)
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

  // Authenticate user to prevent IDOR
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  // Get merchant_id for authorization
  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!merchant) {
    return [];
  }

  // Fetch customer with merchant verification
  const { data: customer } = await supabase
    .from('customers')
    .select('id, merchant_id, email')
    .eq('id', customerId)
    .eq('merchant_id', merchant.id)
    .single();

  if (!customer) return [];

  const { data: orders, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('merchant_id', customer.merchant_id)
    .eq('customer_email', customer.email)
    .order('created_at', { ascending: false });

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
    shipping_address: order.shipping_address || 'N/A',
    items: (order.order_items || []).map((item: OrderItemData) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
    })),
  }));
}
