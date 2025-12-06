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
  createdAt: number;
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

  const realOrders = (orders || []).map((order) => ({
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
    createdAt: new Date(order.created_at).getTime(),
    source: order.source === 'online_store' ? 'other' : order.source,
    tracking_number: order.tracking_number,
    shipping_provider: order.shipping_provider,
    items: (order.order_items || []).map((item: any) => ({
      id: item.id,
      name: item.name || 'Unknown Product',
      quantity: item.quantity,
      price: Number.parseFloat(item.price || 0),
      image: undefined,
      variant: item.variant_name || undefined,
    })).concat(order.order_number === '#00000001' ? [
      { id: 'mock1', name: 'Vintage Sunglasses', quantity: 1, price: 4500, image: undefined, variant: 'Black' },
      { id: 'mock2', name: 'Cotton T-Shirt', quantity: 2, price: 2000, image: undefined, variant: 'L / White' },
      { id: 'mock3', name: 'Leather Belt', quantity: 1, price: 3500, image: undefined, variant: 'Brown' }
    ] : []),
  }));

  // --- MOCK DATA GENERATION FOR UI TESTING ---
  const mockOrders: Order[] = [];
  const customers = ['Alice Johnson', 'Bob Smith', 'Charlie Brown', 'Diana Prince', 'Evan Wright'];
  const products = [
    { name: 'Wireless Headphones', price: 15000 },
    { name: 'Running Shoes', price: 25000 },
    { name: 'Yoga Mat', price: 5000 },
    { name: 'Water Bottle', price: 3000 },
    { name: 'Protein Powder', price: 12000 },
    { name: 'Smart Watch', price: 45000 },
    { name: 'Gym Bag', price: 8000 },
    { name: 'Resistance Bands', price: 2500 }
  ];

  for (let i = 1; i <= 10; i++) {
    const randomDate = new Date();
    randomDate.setDate(randomDate.getDate() - Math.floor(Math.random() * 7));

    const itemCount = [3, 5, 7, 2, 8][Math.floor(Math.random() * 5)];
    const mockItems = Array.from({ length: itemCount }).map((_, idx) => {
      const prod = products[Math.floor(Math.random() * products.length)];
      return {
        id: `mock-item-${i}-${idx}`,
        name: prod.name,
        quantity: Math.floor(Math.random() * 3) + 1,
        price: prod.price,
        image: undefined,
        variant: Math.random() > 0.5 ? 'Default' : undefined
      };
    });

    mockOrders.push({
      id: `mock-order-${i}`,
      orderNumber: `#MOCK${i.toString().padStart(4, '0')}`,
      customerName: customers[Math.floor(Math.random() * customers.length)],
      total: mockItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      shippingStatus: ['Pending', 'Processing', 'Shipped', 'Delivered'][Math.floor(Math.random() * 4)] as ShippingStatus,
      paymentStatus: ['Paid', 'Unpaid', 'Pending'][Math.floor(Math.random() * 3)] as PaymentStatus,
      date: randomDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      createdAt: randomDate.getTime(),
      source: Math.random() > 0.5 ? 'online_store' : 'instagram',
      items: mockItems
    });
  }

  return [...realOrders, ...mockOrders];
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
    createdAt: new Date(order.created_at).getTime(),
    source: order.source === 'online_store' ? 'other' : order.source,
    tracking_number: order.tracking_number,
    shipping_provider: order.shipping_provider,
    items: (order.order_items || []).map((item: any) => ({
      id: item.id,
      name: item.name || 'Unknown Product',
      quantity: item.quantity,
      price: Number.parseFloat(item.price || 0),
      image: undefined, // Image not available without product join
      variant: item.variant_name || undefined,
    })),
  };
}
