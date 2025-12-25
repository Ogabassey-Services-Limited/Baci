'use server';

import { cookies } from 'next/headers';
import { generateOrderConfirmationEmail, generateOrderConfirmationText } from '@/lib/email-templates';
import { logger } from '@/lib/logger';
import { sanitizeLikePattern, sanitizeSearchQuery } from '@/lib/sanitize-core';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/zeptomail';

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

export interface Transaction {
  id: string;
  reference: string;
  status: string;
  amount: number;
  currency: string;
  gateway: string;
  created_at: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  shippingStatus: ShippingStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string | null;
  date: string;
  createdAt: number;
  source: string;
  tracking_number?: string;
  shipping_provider?: string;
  payment_reference?: string;
  customer_email?: string;
  customer_phone?: string;
  notes?: string;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
    image?: string;
    variant?: string;
    hasAssurance?: boolean;
  }>;
  transactions?: Transaction[];
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

interface OrderItem {
  id: string;
  name?: string;
  quantity: number;
  price?: string | number;
  variant_name?: string;
  has_assurance?: boolean;
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
    paymentMethod: order.payment_method,
    date: new Date(order.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    createdAt: new Date(order.created_at).getTime(),
    source: order.source === 'online_store' ? 'other' : order.source,
    tracking_number: order.tracking_number,
    shipping_provider: order.shipping_provider,
    items: (order.order_items || []).map((item: OrderItem) => ({
      id: item.id,
      name: item.name || 'Unknown Product',
      quantity: item.quantity,
      price: Number.parseFloat(String(item.price || 0)),
      image: undefined,
      variant: item.variant_name || undefined,
      hasAssurance: item.has_assurance || false,
    })),
  }));

  return realOrders;
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

  // Fetch transactions
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('order_id', order.id)
    .order('created_at', { ascending: false });

  return {
    id: order.id,
    orderNumber: order.order_number,
    customerName: order.customer_name,
    total: Number.parseFloat(order.total),
    shippingStatus: formatStatus(order.shipping_status) as ShippingStatus,
    paymentStatus: formatStatus(order.payment_status) as PaymentStatus,
    paymentMethod: order.payment_method,
    date: new Date(order.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    createdAt: new Date(order.created_at).getTime(),
    source: order.source === 'online_store' ? 'other' : order.source,
    tracking_number: order.tracking_number,
    shipping_provider: order.shipping_provider,
    payment_reference: order.payment_reference,
    customer_email: order.customer_email,
    customer_phone: order.customer_phone,
    notes: order.notes,
    items: (order.order_items || []).map((item: OrderItem) => ({
      id: item.id,
      name: item.name || 'Unknown Product',
      quantity: item.quantity,
      price: Number.parseFloat(String(item.price || 0)),
      image: undefined, // Image not available without product join
      variant: item.variant_name || undefined,
      hasAssurance: item.has_assurance || false,
    })),
    transactions: (transactions || []).map((tx: any) => ({
      id: tx.id,
      reference: tx.gateway_reference,
      status: tx.status,
      amount: tx.amount,
      currency: tx.currency,
      gateway: tx.gateway,
      created_at: tx.created_at,
    })),
  };
}

export async function resendOrderConfirmation(
  orderId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // 1. Fetch Order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      logger.error({
        message: 'Resend Notification: Order not found',
        orderId,
        error: orderError,
      });
      return { success: false, message: 'Order not found' };
    }

    if (!order.customer_email) {
      return { success: false, message: 'Customer has no email address' };
    }

    // 2. Fetch Merchant Details
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('business_name, slug, support_email, email_sender_name, email')
      .eq('id', order.merchant_id)
      .single();

    if (merchantError || !merchant) {
      logger.error({
        message: 'Resend Notification: Merchant not found',
        merchantId: order.merchant_id,
        error: merchantError,
      });
      return { success: false, message: 'Merchant profile not found' };
    }

    // 3. Prepare Email Data
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
    const merchantUrl = `https://${merchant.slug}.${rootDomain}`;

    // biome-ignore lint/suspicious/noExplicitAny: items handling
    const emailItems = (order.order_items || []).map((item: any) => ({
      name: item.name || 'Product',
      quantity: item.quantity || 1,
      price: item.price || 0,
    }));

    const emailData = {
      orderNumber: order.order_number || order.id.slice(0, 8).toUpperCase(),
      customerName: order.customer_name,
      items: emailItems,
      subtotal: Number.parseFloat(order.subtotal || '0'),
      shippingFee: Number.parseFloat(order.shipping_fee || '0'),
      total: Number.parseFloat(order.total || '0'),
      shippingAddress: {
        address: order.shipping_address?.address || '',
        city: order.shipping_address?.city || '',
        state: order.shipping_address?.state || '',
        phone: order.customer_phone || '',
      },
      merchantName: merchant.business_name,
      merchantUrl,
    };

    const htmlContent = generateOrderConfirmationEmail(emailData);
    const textContent = generateOrderConfirmationText(emailData);

    // 4. Send Email
    const replyToEmail =
      merchant.support_email ||
      merchant.email ||
      `support@${merchant.slug}.${rootDomain}`;

    const senderName = merchant.email_sender_name
      ? `${merchant.email_sender_name} Orders`
      : merchant.business_name
        ? `${merchant.business_name} Orders`
        : undefined;

    await sendEmail({
      to: order.customer_email,
      toName: order.customer_name,
      subject: `Order Confirmation - #${emailData.orderNumber}`,
      htmlContent,
      textContent,
      replyTo: replyToEmail,
      emailType: 'orders',
      fromName: senderName,
    });

    logger.info({
      message: 'Order confirmation email resent manually',
      orderId: order.id,
      adminUser: (await supabase.auth.getUser()).data.user?.id,
    });

    return {
      success: true,
      message: 'Order confirmation email sent successfully',
    };
  } catch (error) {
    logger.error({ message: 'Resend Notification: System error', error });
    return {
      success: false,
      message: 'Failed to send email. Please try again.',
    };
  }
}
