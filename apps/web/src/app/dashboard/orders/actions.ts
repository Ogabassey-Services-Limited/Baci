'use server';

import { cookies } from 'next/headers';
import {
  generateOrderConfirmationEmail,
  generateOrderConfirmationText,
} from '@/lib/email-templates';
import { formatPersonName } from '@/lib/format-person-name';
import { logger } from '@/lib/logger';
import { ensurePermission } from '@/lib/merchant-server';
import { ORDER_WITH_ITEMS_QUERY } from '@/lib/order-queries';
import { sanitizeLikePattern, sanitizeSearchQuery } from '@/lib/sanitize-core';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/zeptomail';
import { loadOrderItemImageMap } from './order-item-images';
import type { PaymentStatus, ShippingStatus } from './order-statuses';

export type { PaymentStatus, ShippingStatus } from './order-statuses';

export interface Transaction {
  id: string;
  reference?: string;
  gateway_reference?: string;
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
  paymentStatus?: PaymentStatus | 'All';
  shippingStatus?: ShippingStatus | 'All';
  search?: string;
}

interface OrderItem {
  id: string;
  name?: string;
  product_id?: string | null;
  image_url?: string | null;
  quantity: number;
  price?: string | number;
  variant_name?: string;
  has_assurance?: boolean;
}

interface DashboardOrderRecord {
  id: string;
  order_number: string;
  customer_name: string;
  total: string;
  shipping_status: string;
  payment_status: string;
  payment_method: string | null;
  created_at: string;
  source: string;
  tracking_number?: string;
  shipping_provider?: string;
  payment_reference?: string;
  customer_email?: string;
  customer_phone?: string;
  notes?: string;
  order_items?: OrderItem[];
}

interface OrderConfirmationRecord {
  id: string;
  merchant_id: string;
  customer_id?: string | null;
  order_number: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  subtotal?: string;
  shipping_fee?: string;
  total: string;
  shipping_address?: {
    address?: string;
    city?: string;
    state?: string;
  };
  order_items?: Array<{
    name?: string;
    quantity?: number;
    price?: string | number;
  }>;
}

export interface JumiaOrderItem {
  id?: string;
  name?: string;
  price?: string | number;
  image_url?: string;
}

export interface JumiaOrder {
  jumia_order_id: string;
  jumia_order_number: string;
  customer_name: string | null;
  total_amount: string;
  status: string;
  created_at_jumia: string;
  items?: JumiaOrderItem[];
}

const ORDER_CONFIRMATION_SELECT = [
  'id',
  'merchant_id',
  'order_number',
  'customer_name',
  'customer_email',
  'customer_phone',
  'subtotal',
  'shipping_fee',
  'total',
  'shipping_address',
  'order_items(id, image_url, name, quantity, price)',
].join(', ');
function isActiveFilter<T extends string>(
  value: T | 'All' | undefined
): value is T {
  return Boolean(value && value !== 'All');
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
  const paymentStatusFilter = filters.paymentStatus;
  const shippingStatusFilter = filters.shippingStatus;
  const hasPaymentFilter = isActiveFilter(paymentStatusFilter);
  const hasShippingFilter = isActiveFilter(shippingStatusFilter);

  let query = supabase
    .from('orders')
    .select(ORDER_WITH_ITEMS_QUERY)
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false });

  // Apply filters
  if (hasPaymentFilter) {
    query = query.eq(
      'payment_status',
      paymentStatusFilter.toLowerCase().replace(/\s+/g, '_')
    );
  }

  if (hasShippingFilter) {
    query = query.eq('shipping_status', shippingStatusFilter.toLowerCase());
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

  const { data: ordersData, error } = await query;

  if (error) {
    logger.error({
      message: 'Error fetching dashboard orders',
      error,
      merchantId,
      filters,
      route: 'dashboard/orders/getOrders',
    });
    throw new Error('Failed to fetch dashboard orders');
  }

  // FETCH JUMIA ORDERS (If no specific payment/shipping filter that excludes them)
  // Jumia orders don't have standard payment/shipping statuses in the same way,
  // but we map them.
  let jumiaOrders: JumiaOrder[] = [];
  if (!hasPaymentFilter && !hasShippingFilter) {
    const { data: jOrders, error: jumiaOrdersError } = await supabase
      .from('jumia_orders')
      .select(
        'status, jumia_order_id, jumia_order_number, customer_name, total_amount, created_at_jumia, items'
      )
      .eq('merchant_id', merchantId)
      .is('baci_order_id', null)
      .order('created_at_jumia', { ascending: false });
    if (jumiaOrdersError) {
      logger.error({
        message: 'Error fetching legacy Jumia orders',
        error: jumiaOrdersError,
        merchantId,
        route: 'dashboard/orders/getOrders',
      });
    } else {
      jumiaOrders = jOrders || [];
    }
  }

  const orders = (ordersData || []) as unknown as DashboardOrderRecord[];

  const orderItemImageMap = await loadOrderItemImageMap(
    supabase,
    orders.flatMap((order) =>
      (order.order_items || []).map((item: OrderItem) => item.product_id)
    )
  );

  const realOrders = orders.map((order) => ({
    id: order.id,
    orderNumber: order.order_number,
    customerName: formatPersonName(order.customer_name || 'Customer'),
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
    source: order.source,
    tracking_number: order.tracking_number,
    shipping_provider: order.shipping_provider,
    items: (order.order_items || []).map((item: OrderItem) => ({
      id: item.id,
      name: item.name || 'Unknown Product',
      quantity: item.quantity,
      price: Number.parseFloat(String(item.price || 0)),
      image: item.image_url
        ? item.image_url
        : item.product_id
          ? orderItemImageMap.get(item.product_id)
          : undefined,
      variant: item.variant_name || undefined,
      hasAssurance: item.has_assurance || false,
    })),
  }));

  // Normalize Jumia Orders
  const normalizedJumiaOrders = jumiaOrders.map((jOrder) => {
    // Basic mapping of Jumia Status to Internal Status
    // Jumia: pending, shipped, delivered, canceled, failed
    let shippingStatus: ShippingStatus = 'Pending';
    let paymentStatus: PaymentStatus = 'Paid'; // Assumed paid to Jumia

    const startStatus = jOrder.status.toLowerCase();
    if (startStatus.includes('shipped')) shippingStatus = 'Shipped';
    if (startStatus.includes('delivered')) shippingStatus = 'Delivered';
    if (startStatus.includes('cancel')) {
      shippingStatus = 'Canceled';
      paymentStatus = 'Refunded';
    }
    if (startStatus.includes('fail')) shippingStatus = 'Canceled';

    return {
      id: jOrder.jumia_order_id, // Use Jumia ID as ID
      orderNumber: jOrder.jumia_order_number,
      customerName: formatPersonName(jOrder.customer_name || 'Jumia Customer'),
      total: Number.parseFloat(jOrder.total_amount),
      shippingStatus,
      paymentStatus,
      paymentMethod: 'Jumia Payout',
      date: new Date(jOrder.created_at_jumia).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      createdAt: new Date(jOrder.created_at_jumia).getTime(),
      source: 'jumia',
      tracking_number: undefined,
      shipping_provider: 'Jumia Services',
      items: (jOrder.items || []).map((item: JumiaOrderItem, idx: number) => ({
        id: item.id || `jumia-item-${idx}`,
        name: item.name || 'Jumia Item',
        quantity: 1, // Usually Jumia lines are qty 1 per object in older APIs, check actual data structure.
        // For now assuming 1 if not specified.
        price: Number(item.price || 0),
        image: item.image_url,
        variant: undefined,
      })),
    } as Order;
  });

  // Merge and Sort
  const allOrders = [...realOrders, ...normalizedJumiaOrders].sort(
    (a, b) => b.createdAt - a.createdAt
  );

  return allOrders;
}

export async function getOrderStats(merchantId: string): Promise<OrderStats> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Fetch all order counts concurrently for stats calculation
  // PERFORMANCE: Use .select('id', { count: 'exact', head: true }) instead of fetching all rows
  // to avoid large memory allocations and slow responses for merchants with many orders
  const [
    { count: totalOrders, error: totalError },
    { count: completedOrders, error: completedError },
    { count: unpaidOrders, error: unpaidError },
    { count: urgentOrders, error: urgentError },
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchantId),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchantId)
      .eq('shipping_status', 'delivered'),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchantId)
      .eq('payment_status', 'unpaid'),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchantId)
      .or('payment_status.eq.unpaid,shipping_status.eq.pending'),
  ]);

  if (totalError || completedError || unpaidError || urgentError) {
    console.error(
      'Error fetching order stats counts:',
      totalError || completedError || unpaidError || urgentError
    );
    return {
      totalOrders: 0,
      completedOrders: 0,
      unpaidOrders: 0,
      urgentOrders: 0,
    };
  }

  return {
    totalOrders: totalOrders || 0,
    completedOrders: completedOrders || 0,
    unpaidOrders: unpaidOrders || 0,
    urgentOrders: urgentOrders || 0,
  };
}

export async function getOrder(
  merchantId: string,
  orderIdentifier: string
): Promise<Order | null> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Check if identifier is UUID
  const isUuid =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
      orderIdentifier
    );

  let order: DashboardOrderRecord | null = null;
  let orderError: { message?: string } | null = null;

  if (isUuid) {
    const { data, error } = await supabase
      .from('orders')
      .select(ORDER_WITH_ITEMS_QUERY)
      .eq('merchant_id', merchantId)
      .eq('id', orderIdentifier)
      .maybeSingle();

    order = data as DashboardOrderRecord | null;
    orderError = error;
  } else {
    const normalizedIdentifier = orderIdentifier.replace(/^#/, '').trim();
    const candidateOrderNumbers = [
      normalizedIdentifier,
      `#${normalizedIdentifier}`,
    ].filter((value, index, values) => values.indexOf(value) === index);

    for (const candidateOrderNumber of candidateOrderNumbers) {
      const { data, error } = await supabase
        .from('orders')
        .select(ORDER_WITH_ITEMS_QUERY)
        .eq('merchant_id', merchantId)
        .eq('order_number', candidateOrderNumber)
        .maybeSingle();

      if (error) {
        orderError = error;
        break;
      }

      if (data) {
        order = data as DashboardOrderRecord;
        break;
      }
    }
  }

  if (orderError || !order) {
    if (orderError) {
      logger.error({
        message: 'Error fetching order',
        error: orderError,
        merchantId,
        orderIdentifier,
        route: 'dashboard/orders/getOrder',
      });
    }
    return null;
  }

  const orderItemImageMap = await loadOrderItemImageMap(
    supabase,
    (order.order_items || []).map((item: OrderItem) => item.product_id)
  );

  // Fetch transactions
  const { data: transactions } = await supabase
    .from('transactions')
    .select(
      'id, gateway_reference, status, amount, currency, gateway, created_at'
    )
    .eq('order_id', order.id)
    .order('created_at', { ascending: false });

  return {
    id: order.id,
    orderNumber: order.order_number,
    customerName: formatPersonName(order.customer_name || 'Customer'),
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
    source: order.source,
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
      image: item.image_url
        ? item.image_url
        : item.product_id
          ? orderItemImageMap.get(item.product_id)
          : undefined,
      variant: item.variant_name || undefined,
      hasAssurance: item.has_assurance || false,
    })),
    transactions: (transactions || []).map((tx: Transaction) => ({
      id: tx.id,
      reference: tx.reference || tx.gateway_reference || '',
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
    const { merchant: authorizedMerchant } = await ensurePermission(
      'orders',
      'edit'
    );
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select(
        'id, business_name, slug, support_email, email_sender_name, email, tax_identification_number, cac_rc_number'
      )
      .eq('id', authorizedMerchant.id)
      .single();

    if (merchantError || !merchant) {
      logger.error({
        message: 'Resend Notification: Merchant not found',
        merchantId: authorizedMerchant.id,
        error: merchantError,
      });
      return { success: false, message: 'Merchant profile not found' };
    }

    // 2. Fetch Order with merchant scope
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select(ORDER_CONFIRMATION_SELECT)
      .eq('id', orderId)
      .eq('merchant_id', merchant.id)
      .single();
    const order = orderData as unknown as OrderConfirmationRecord | null;

    if (orderError || !order) {
      logger.error({
        message: 'Resend Notification: Order not found',
        orderId,
        merchantId: merchant.id,
        error: orderError,
      });
      return { success: false, message: 'Order not found' };
    }

    if (!order.customer_email) {
      return { success: false, message: 'Customer has no email address' };
    }

    // 3. Prepare Email Data
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
    const merchantUrl = `https://${merchant.slug}.${rootDomain}`;

    const emailItems = (order.order_items || []).map((item) => ({
      name: item.name || 'Product',
      quantity: item.quantity || 1,
      price: Number.parseFloat(String(item.price || 0)),
    }));

    const emailData = {
      orderNumber: order.order_number || order.id.slice(0, 8).toUpperCase(),
      customerName: formatPersonName(order.customer_name || 'Customer'),
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
      merchantTin: merchant.tax_identification_number ?? undefined,
      merchantRcNumber: merchant.cac_rc_number ?? undefined,
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
      toName: formatPersonName(order.customer_name || 'Customer'),
      subject: `Order Confirmation - #${emailData.orderNumber}`,
      htmlContent,
      textContent,
      replyTo: replyToEmail,
      emailType: 'orders',
      fromName: senderName,
      auditContext: {
        merchantId: merchant.id,
        orderId: order.id,
        customerId: order.customer_id,
        metadata: {
          trigger: 'manual_resend_order_confirmation',
        },
      },
    });

    logger.info({
      message: 'Order confirmation email resent manually',
      orderId: order.id,
      merchantId: merchant.id,
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
