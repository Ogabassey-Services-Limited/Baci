/**
 * Expo Push Notification Service
 * Sends push notifications to merchant mobile apps via Expo's push service
 *
 * @see https://docs.expo.dev/push-notifications/sending-notifications/
 */

import { createAdminClient } from '@/lib/supabase/admin';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Expo push notification message format
 */
export interface ExpoPushMessage {
  to: string | string[];
  title?: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
  ttl?: number;
  expiration?: number;
  categoryId?: string;
}

/**
 * Expo push response ticket
 */
export interface ExpoPushTicket {
  id?: string;
  status: 'ok' | 'error';
  message?: string;
  details?: {
    error?:
      | 'DeviceNotRegistered'
      | 'MessageTooBig'
      | 'MessageRateExceeded'
      | 'InvalidCredentials'
      | string;
  };
}

/**
 * Notification channel types for Android
 */
export type NotificationChannel =
  | 'orders'
  | 'payments'
  | 'stock'
  | 'general'
  | 'promotions';

/**
 * Send push notification to a single token
 */
export async function sendPushNotification(
  token: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
  channelId: NotificationChannel = 'general'
): Promise<ExpoPushTicket> {
  const messages: ExpoPushMessage[] = [
    {
      to: token,
      title,
      body,
      data,
      sound: 'default',
      channelId,
      priority: channelId === 'orders' ? 'high' : 'default',
    },
  ];

  const tickets = await sendPushNotifications(messages);
  return tickets[0];
}

/**
 * Send push notifications to multiple tokens
 */
export async function sendPushNotifications(
  messages: ExpoPushMessage[]
): Promise<ExpoPushTicket[]> {
  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Expo push API error:', error);
      return messages.map(() => ({
        status: 'error' as const,
        message: `HTTP ${response.status}: ${error}`,
      }));
    }

    const result = await response.json();
    return result.data as ExpoPushTicket[];
  } catch (error) {
    console.error('Error sending push notifications:', error);
    return messages.map(() => ({
      status: 'error' as const,
      message: error instanceof Error ? error.message : 'Unknown error',
    }));
  }
}

/**
 * Send notification to all active tokens for a merchant
 */
export async function notifyMerchant(
  merchantId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
  channelId: NotificationChannel = 'general'
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const supabase = createAdminClient();

  // Get all active push tokens for this merchant
  const { data: tokens, error } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('merchant_id', merchantId)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching push tokens:', error);
    return { sent: 0, failed: 0, errors: [error.message] };
  }

  if (!tokens || tokens.length === 0) {
    return { sent: 0, failed: 0, errors: [] };
  }

  // Create messages for all tokens
  const messages: ExpoPushMessage[] = tokens.map((t) => ({
    to: t.token,
    title,
    body,
    data,
    sound: 'default',
    channelId,
    priority: channelId === 'orders' ? 'high' : 'default',
  }));

  // Send all notifications
  const tickets = await sendPushNotifications(messages);

  // Count results
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  const tokensToDeactivate: string[] = [];

  tickets.forEach((ticket, index) => {
    if (ticket.status === 'ok') {
      sent++;
    } else {
      failed++;
      if (ticket.message) {
        errors.push(ticket.message);
      }
      // Handle invalid tokens
      if (ticket.details?.error === 'DeviceNotRegistered') {
        tokensToDeactivate.push(tokens[index].token);
      }
    }
  });

  // Deactivate invalid tokens
  if (tokensToDeactivate.length > 0) {
    await supabase
      .from('push_tokens')
      .update({ is_active: false })
      .in('token', tokensToDeactivate);
  }

  return { sent, failed, errors };
}

/**
 * Send notification to a specific customer by user_id
 * Used for customer-facing mobile apps (like Ogabassey storefront)
 */
export async function notifyCustomer(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
  channelId: NotificationChannel = 'orders'
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const supabase = createAdminClient();

  // Get all active push tokens for this user
  const { data: tokens, error } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching customer push tokens:', error);
    return { sent: 0, failed: 0, errors: [error.message] };
  }

  if (!tokens || tokens.length === 0) {
    return { sent: 0, failed: 0, errors: [] };
  }

  // Create messages for all tokens
  const messages: ExpoPushMessage[] = tokens.map((t) => ({
    to: t.token,
    title,
    body,
    data,
    sound: 'default',
    channelId,
    priority: channelId === 'orders' ? 'high' : 'default',
  }));

  // Send all notifications
  const tickets = await sendPushNotifications(messages);

  // Count results
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  const tokensToDeactivate: string[] = [];

  tickets.forEach((ticket, index) => {
    if (ticket.status === 'ok') {
      sent++;
    } else {
      failed++;
      if (ticket.message) {
        errors.push(ticket.message);
      }
      if (ticket.details?.error === 'DeviceNotRegistered') {
        tokensToDeactivate.push(tokens[index].token);
      }
    }
  });

  // Deactivate invalid tokens
  if (tokensToDeactivate.length > 0) {
    await supabase
      .from('push_tokens')
      .update({ is_active: false })
      .in('token', tokensToDeactivate);
  }

  return { sent, failed, errors };
}

// =============================================================================
// MERCHANT NOTIFICATION EVENT HELPERS
// =============================================================================

/**
 * Notify merchant of a new order
 */
export async function notifyNewOrder(
  merchantId: string,
  orderNumber: string,
  customerName: string,
  amount: number,
  currency = 'NGN'
): Promise<void> {
  const formattedAmount = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);

  await notifyMerchant(
    merchantId,
    '🛒 New Order',
    `Order #${orderNumber} from ${customerName} - ${formattedAmount}`,
    {
      type: 'new_order',
      order_number: orderNumber,
      amount,
      currency,
    },
    'orders'
  );
}

/**
 * Notify merchant of payment received
 */
export async function notifyPaymentReceived(
  merchantId: string,
  amount: number,
  currency = 'NGN',
  orderNumber?: string
): Promise<void> {
  const formattedAmount = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);

  const body = orderNumber
    ? `Payment of ${formattedAmount} received for order #${orderNumber}`
    : `Payment of ${formattedAmount} received`;

  await notifyMerchant(
    merchantId,
    '💰 Payment Received',
    body,
    {
      type: 'payment_received',
      amount,
      currency,
      order_number: orderNumber,
    },
    'payments'
  );
}

/**
 * Notify merchant of low stock
 */
export async function notifyLowStock(
  merchantId: string,
  productName: string,
  currentStock: number,
  threshold: number
): Promise<void> {
  await notifyMerchant(
    merchantId,
    '⚠️ Low Stock Alert',
    `${productName} is low on stock (${currentStock} remaining, threshold: ${threshold})`,
    {
      type: 'low_stock',
      product_name: productName,
      current_stock: currentStock,
      threshold,
    },
    'stock'
  );
}

/**
 * Notify merchant of a new review
 */
export async function notifyNewReview(
  merchantId: string,
  productName: string,
  rating: number,
  reviewerName: string
): Promise<void> {
  const stars = '⭐'.repeat(rating);

  await notifyMerchant(
    merchantId,
    '📝 New Review',
    `${reviewerName} left a ${rating}-star review on ${productName} ${stars}`,
    {
      type: 'new_review',
      product_name: productName,
      rating,
      reviewer_name: reviewerName,
    },
    'general'
  );
}

/**
 * Notify merchant of withdrawal processed
 */
export async function notifyWithdrawalProcessed(
  merchantId: string,
  amount: number,
  currency = 'NGN',
  bankName?: string
): Promise<void> {
  const formattedAmount = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);

  const body = bankName
    ? `${formattedAmount} has been sent to your ${bankName} account`
    : `${formattedAmount} withdrawal has been processed`;

  await notifyMerchant(
    merchantId,
    '🏦 Withdrawal Processed',
    body,
    {
      type: 'withdrawal_processed',
      amount,
      currency,
      bank_name: bankName,
    },
    'payments'
  );
}

/**
 * Notify merchant of a new Jumia order
 */
export async function notifyJumiaOrder(
  merchantId: string,
  jumiaOrderNumber: string,
  customerName: string,
  amount: number,
  currency = 'NGN'
): Promise<void> {
  const formattedAmount = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);

  await notifyMerchant(
    merchantId,
    '🟠 Jumia Order',
    `Order #${jumiaOrderNumber} from ${customerName} - ${formattedAmount}`,
    {
      type: 'jumia_order',
      jumia_order_number: jumiaOrderNumber,
      amount,
      currency,
    },
    'orders' // Uses orders channel (HIGH priority)
  );
}

// =============================================================================
// CUSTOMER NOTIFICATION EVENT HELPERS (for storefront mobile apps)
// =============================================================================

/**
 * Notify customer of order status change
 */
export async function notifyOrderStatusChange(
  userId: string,
  orderId: string,
  orderNumber: string,
  status: string,
  message?: string
): Promise<void> {
  const statusTitles: Record<string, string> = {
    confirmed: '✅ Order Confirmed!',
    processing: '📦 Order Being Prepared',
    shipped: '🚚 Order Shipped!',
    out_for_delivery: '🛵 Out for Delivery!',
    delivered: '🎉 Order Delivered!',
    cancelled: '❌ Order Cancelled',
    refunded: '💰 Refund Processed',
  };

  const statusMessages: Record<string, string> = {
    confirmed: `Your order #${orderNumber} has been confirmed and is being processed.`,
    processing: `Your order #${orderNumber} is being prepared for shipping.`,
    shipped: `Great news! Your order #${orderNumber} has been shipped.`,
    out_for_delivery: `Your order #${orderNumber} is out for delivery. Get ready!`,
    delivered: `Your order #${orderNumber} has been delivered. Enjoy!`,
    cancelled: `Your order #${orderNumber} has been cancelled.`,
    refunded: `A refund has been processed for order #${orderNumber}.`,
  };

  const title = statusTitles[status] || `Order Update: #${orderNumber}`;
  const body =
    message ||
    statusMessages[status] ||
    `Your order #${orderNumber} status has been updated to ${status}.`;

  await notifyCustomer(
    userId,
    title,
    body,
    {
      type: 'order_update',
      orderId,
      orderNumber,
      status,
    },
    'orders'
  );
}

/**
 * Notify customer of promotional offer
 */
export async function notifyCustomerPromotion(
  userId: string,
  title: string,
  body: string,
  productSlug?: string,
  categorySlug?: string
): Promise<void> {
  await notifyCustomer(
    userId,
    title,
    body,
    {
      type: 'promotion',
      productSlug,
      categorySlug,
    },
    'promotions'
  );
}

/**
 * Notify customer that a product is back in stock
 */
export async function notifyBackInStock(
  userId: string,
  productName: string,
  productSlug: string
): Promise<void> {
  await notifyCustomer(
    userId,
    '🔔 Back in Stock!',
    `${productName} is now available. Get it before it's gone!`,
    {
      type: 'back_in_stock',
      productSlug,
    },
    'promotions'
  );
}

/**
 * Notify merchant of a new negotiation request from a customer
 */
export async function notifyNegotiationRequest(
  merchantId: string,
  negotiationType: 'single' | 'total',
  offeredPrice: number,
  negotiationId: string,
  itemName: string | null,
  currentPrice: number | null
): Promise<void> {
  const label =
    negotiationType === 'single' ? (itemName ?? 'an item') : 'their cart total';

  const priceStr = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(offeredPrice);

  const title = '🤝 New Price Negotiation';
  const body = currentPrice
    ? `A customer offered ${priceStr} for ${label} (listed at ₦${currentPrice.toLocaleString()})`
    : `A customer offered ${priceStr} for ${label}`;

  await notifyMerchant(merchantId, title, body, {
    type: 'negotiation_request',
    negotiationId,
    negotiationType,
    offeredPrice,
    currentPrice,
  });
}

/**
 * Notify customer of a merchant's response to their negotiation
 */
export async function notifyNegotiationResponse(
  customerId: string,
  negotiationType: 'single' | 'total',
  status: 'accepted' | 'rejected',
  itemName: string | null,
  acceptedPrice: number | null
): Promise<void> {
  const label =
    negotiationType === 'single'
      ? (itemName ?? 'your item')
      : 'your cart total';

  if (status === 'accepted') {
    const priceStr = acceptedPrice
      ? new Intl.NumberFormat('en-NG', {
          style: 'currency',
          currency: 'NGN',
          minimumFractionDigits: 0,
        }).format(acceptedPrice)
      : 'your offer';

    await notifyCustomer(
      customerId,
      '✅ Offer Accepted!',
      `The merchant accepted ${priceStr} for ${label}. Complete your purchase now!`,
      { type: 'negotiation_accepted', negotiationType, acceptedPrice },
      'orders'
    );
  } else {
    await notifyCustomer(
      customerId,
      '❌ Offer Declined',
      `The merchant declined your offer for ${label}. You can try a new offer or buy at the listed price.`,
      { type: 'negotiation_rejected', negotiationType },
      'orders'
    );
  }
}

/**
 * Notify customer of price drop on a wishlisted item
 */
export async function notifyPriceDrop(
  userId: string,
  productName: string,
  productSlug: string,
  oldPrice: number,
  newPrice: number,
  currency = 'NGN'
): Promise<void> {
  const formatPrice = (price: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(price);

  const discount = Math.round(((oldPrice - newPrice) / oldPrice) * 100);

  await notifyCustomer(
    userId,
    `💸 Price Drop: ${discount}% Off!`,
    `${productName} is now ${formatPrice(newPrice)} (was ${formatPrice(oldPrice)})`,
    {
      type: 'price_drop',
      productSlug,
      oldPrice,
      newPrice,
      discount,
    },
    'promotions'
  );
}
