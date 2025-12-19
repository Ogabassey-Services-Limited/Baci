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
export type NotificationChannel = 'orders' | 'payments' | 'stock' | 'general';

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

// =============================================================================
// NOTIFICATION EVENT HELPERS
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
