'use server';

import { cookies } from 'next/headers';
import { sanitizeLikePattern, sanitizeSearchQuery } from '@/lib/sanitize-core';
import { createClient } from '@/lib/supabase/server';

export type ShippingStatus =
  | 'Pending'
  | 'Processing'
  | 'Shipped'
  | 'Delivered'
  | 'Canceled'
  | 'Returned';

export type PaymentStatus =
  | 'Paid'
  | 'Unpaid'
  | 'Pending'
  | 'Partially Paid'
  | 'Refunded';

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  shippingStatus: ShippingStatus;
  paymentStatus: PaymentStatus;
  date: string;
  source: string;
  tracking_number?: string;
  shipping_provider?: string;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
    image?: string;
    variant?: string;
  }>;
}

export interface OrderStats {
  totalOrders: number;
  completedOrders: number;
  unpaidOrders: number;
  urgentOrders: number;
}

interface OrderFilters {
  paymentStatus?: string;
  shippingStatus?: string;
  search?: string;
}

function formatStatus(status: string): string {
  if (!status) return 'Pending';
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export async function getOrders(
  merchantId: string,
  filters: OrderFilters = {}
): Promise<Order[]> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  let query = supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false });

  // Apply filters
  if (filters.paymentStatus && filters.paymentStatus !== 'All') {
    query = query.eq(
      'payment_status',
      filters.paymentStatus.toLowerCase().replace(' ', '_')
    );
  }

  if (filters.shippingStatus && filters.shippingStatus !== 'All') {
    query = query.eq('shipping_status', filters.shippingStatus.toLowerCase());
  }

  // Search by customer name or order number
  if (filters.search?.trim()) {
    const sanitizedSearch = sanitizeLikePattern(
      sanitizeSearchQuery(filters.search)
    );
    query = query.or(
      `customer_name.ilike.%${sanitizedSearch}%,order_number.ilike.%${sanitizedSearch}%`
    );
  }

  const { data: orders, error } = await query;

  if (error) {
    console.error('Error fetching orders:', error);
    return [];
  }

  return (orders || []).map((order) => ({
    id: order.id,
    orderNumber: order.order_number,
    customerName: order.customer_name,
    total: Number.parseFloat(order.total),
    shippingStatus: formatStatus(order.shipping_status) as ShippingStatus,
    paymentStatus: formatStatus(order.payment_status) as PaymentStatus,
    date: new Date(order.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    source: order.source === 'online_store' ? 'other' : order.source,
    tracking_number: order.tracking_number,
    shipping_provider: order.shipping_provider,
    items: (order.order_items || []).map((item: any) => ({
      id: item.id,
      name: item.name || 'Unknown Product',
      quantity: item.quantity,
      price: Number.parseFloat(item.price || 0),
      image: null, // Image not available without product join
      variant: item.variant_name || null,
    })),
  }));
}

export async function getOrderStats(merchantId: string): Promise<OrderStats> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Fetch all orders for stats calculation
  // Optimized: Select only needed fields
  const { data: orders, error } = await supabase
    .from('orders')
    .select('payment_status, shipping_status')
    .eq('merchant_id', merchantId);

  if (error) {
    console.error('Error fetching order stats:', error);
    return {
      totalOrders: 0,
      completedOrders: 0,
      unpaidOrders: 0,
      urgentOrders: 0,
    };
  }

  const allOrders = orders || [];

  return {
    totalOrders: allOrders.length,
    completedOrders: allOrders.filter((o) => o.shipping_status === 'delivered')
      .length,
    unpaidOrders: allOrders.filter((o) => o.payment_status === 'unpaid').length,
    urgentOrders: allOrders.filter(
      (o) => o.payment_status === 'unpaid' || o.shipping_status === 'pending'
    ).length,
  };
}

export async function getOrder(
  merchantId: string,
  orderIdentifier: string
): Promise<Order | null> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Try fetching by ID first, then order_number
  let query = supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('merchant_id', merchantId);

  // Check if identifier is UUID
  const isUuid =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
      orderIdentifier
    );

  if (isUuid) {
    query = query.eq('id', orderIdentifier);
  } else {
    // Assume order number (remove # if present)
    const orderNum = orderIdentifier.startsWith('#')
      ? orderIdentifier
      : `#${orderIdentifier}`;
    // Also try without hash just in case
    query = query.or(
      `order_number.eq.${orderNum},order_number.eq.${orderIdentifier}`
    );
  }

  const { data: order, error } = await query.single();

  if (error || !order) {
    console.error('Error fetching order:', error);
    return null;
  }

  return {
    id: order.id,
    orderNumber: order.order_number,
    customerName: order.customer_name,
    total: Number.parseFloat(order.total),
    shippingStatus: formatStatus(order.shipping_status) as ShippingStatus,
    paymentStatus: formatStatus(order.payment_status) as PaymentStatus,
    date: new Date(order.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    source: order.source === 'online_store' ? 'other' : order.source,
    tracking_number: order.tracking_number,
    shipping_provider: order.shipping_provider,
    items: (order.order_items || []).map((item: any) => ({
      id: item.id,
      name: item.name || 'Unknown Product',
      quantity: item.quantity,
      price: Number.parseFloat(item.price || 0),
      image: null, // Image not available without product join
      variant: item.variant_name || null,
    })),
  };
}
