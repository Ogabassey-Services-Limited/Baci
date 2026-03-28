/**
 * Expo Push Notification Service
 * Sends push notifications via the official expo-server-sdk.
 *
 * @see https://docs.expo.dev/push-notifications/sending-notifications/
 */

import Expo, {
  type ExpoPushMessage,
  type ExpoPushTicket,
} from 'expo-server-sdk';
import { createAdminClient } from '@/lib/supabase/admin';

// ── Lazy-initialized Expo client (avoids module-level constructor for testability) ──

let _expo: Expo | null = null;
function _getExpo(): Expo {
  if (!_expo) {
    if (!process.env.EXPO_ACCESS_TOKEN) {
      console.warn(
        '[expo-push] EXPO_ACCESS_TOKEN is not set — push notifications may fail or be rate-limited'
      );
    }
    _expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });
  }
  return _expo;
}

// ── Public types ─────────────────────────────────────────────────────────────

export type { ExpoPushMessage, ExpoPushTicket };

/**
 * Notification channel types for Android
 */
export type NotificationChannel =
  | 'orders'
  | 'payments'
  | 'stock'
  | 'general'
  | 'promotions';

// ── Core send functions ──────────────────────────────────────────────────────

/**
 * Send push notification to a single token.
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
 * Send push notifications to multiple tokens.
 *
 * - Validates tokens with `Expo.isExpoPushToken()`
 * - Chunks messages to stay within Expo API limits
 * - Returns a ticket per original message (invalid tokens get synthetic error tickets)
 */
export async function sendPushNotifications(
  messages: ExpoPushMessage[]
): Promise<ExpoPushTicket[]> {
  if (messages.length === 0) return [];

  // Separate valid and invalid token messages, preserving original indices
  const validMessages: ExpoPushMessage[] = [];
  const resultMap: { index: number; ticket?: ExpoPushTicket }[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const token = Array.isArray(msg.to) ? msg.to[0] : msg.to;

    if (Expo.isExpoPushToken(token)) {
      resultMap.push({ index: i });
      validMessages.push(msg);
    } else {
      resultMap.push({
        index: i,
        ticket: {
          status: 'error',
          message: `Invalid Expo push token: ${token}`,
          details: { error: 'DeviceNotRegistered' },
        },
      });
    }
  }

  if (validMessages.length === 0) {
    return resultMap.map((r) => r.ticket as ExpoPushTicket);
  }

  // Chunk and send
  const chunks = _getExpo().chunkPushNotifications(validMessages);
  const sdkTickets: ExpoPushTicket[] = [];

  for (const chunk of chunks) {
    try {
      const chunkTickets = await _getExpo().sendPushNotificationsAsync(chunk);
      sdkTickets.push(...chunkTickets);
    } catch (error) {
      // Synthesize error tickets for the failed chunk
      for (const _ of chunk) {
        sdkTickets.push({
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: { error: 'ExpoError' },
        });
      }
    }
  }

  // Reassemble in original order
  let sdkIndex = 0;
  const finalTickets: ExpoPushTicket[] = [];

  for (const entry of resultMap) {
    if (entry.ticket) {
      finalTickets.push(entry.ticket);
    } else {
      finalTickets.push(sdkTickets[sdkIndex++]);
    }
  }

  return finalTickets;
}

// ── Merchant / Customer delivery ─────────────────────────────────────────────

/**
 * Send notification to all active **admin** tokens for a merchant.
 */
export async function notifyMerchant(
  merchantId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
  channelId: NotificationChannel = 'general'
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const supabase = createAdminClient();

  const { data: tokens, error } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('merchant_id', merchantId)
    .eq('is_active', true)
    .eq('app_type', 'admin');

  if (error) {
    console.error('Error fetching push tokens:', error);
    return { sent: 0, failed: 0, errors: [error.message] };
  }

  if (!tokens || tokens.length === 0) {
    return { sent: 0, failed: 0, errors: [] };
  }

  const messages: ExpoPushMessage[] = tokens.map((t) => ({
    to: t.token,
    title,
    body,
    data,
    sound: 'default' as const,
    channelId,
    priority: (channelId === 'orders' ? 'high' : 'default') as
      | 'high'
      | 'default',
  }));

  const tickets = await sendPushNotifications(messages);

  return processTickets(tickets, tokens, supabase, {
    merchantId,
    appType: 'admin',
    channel: channelId,
    notificationType: (data?.type as string) ?? undefined,
  });
}

/**
 * Send notification to all active **storefront** tokens for a customer.
 */
export async function notifyCustomer(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
  channelId: NotificationChannel = 'orders'
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const supabase = createAdminClient();

  const { data: tokens, error } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId)
    .eq('is_active', true)
    .eq('app_type', 'storefront');

  if (error) {
    console.error('Error fetching customer push tokens:', error);
    return { sent: 0, failed: 0, errors: [error.message] };
  }

  if (!tokens || tokens.length === 0) {
    return { sent: 0, failed: 0, errors: [] };
  }

  const messages: ExpoPushMessage[] = tokens.map((t) => ({
    to: t.token,
    title,
    body,
    data,
    sound: 'default' as const,
    channelId,
    priority: (channelId === 'orders' ? 'high' : 'default') as
      | 'high'
      | 'default',
  }));

  const tickets = await sendPushNotifications(messages);

  return processTickets(tickets, tokens, supabase, {
    userId,
    appType: 'storefront',
    channel: channelId,
    notificationType: (data?.type as string) ?? undefined,
  });
}

// ── Shared ticket processing ─────────────────────────────────────────────────

interface TicketContext {
  merchantId?: string;
  userId?: string;
  appType?: 'admin' | 'storefront';
  channel?: string;
  notificationType?: string;
}

async function processTickets(
  tickets: ExpoPushTicket[],
  tokens: { token: string }[],
  supabase: ReturnType<typeof createAdminClient>,
  context?: TicketContext
): Promise<{ sent: number; failed: number; errors: string[] }> {
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  const tokensToDeactivate: string[] = [];
  const ticketsToStore: Array<{
    ticket_id: string;
    push_token: string;
    merchant_id: string | null;
    user_id: string | null;
    app_type: string;
    channel: string | null;
    notification_type: string | null;
    status: 'pending';
  }> = [];

  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    if (ticket.status === 'ok') {
      sent++;
      // Store ok tickets for receipt polling (they have a ticket.id)
      ticketsToStore.push({
        ticket_id: ticket.id,
        push_token: tokens[i].token,
        merchant_id: context?.merchantId ?? null,
        user_id: context?.userId ?? null,
        app_type: context?.appType ?? 'admin',
        channel: context?.channel ?? null,
        notification_type: context?.notificationType ?? null,
        status: 'pending',
      });
    } else {
      failed++;
      if (ticket.message) {
        errors.push(ticket.message);
      }
      if (ticket.details?.error === 'DeviceNotRegistered') {
        tokensToDeactivate.push(tokens[i].token);
      }
    }
  }

  if (tokensToDeactivate.length > 0) {
    await supabase
      .from('push_tokens')
      .update({ is_active: false })
      .in('token', tokensToDeactivate);
  }

  // Store successful tickets for receipt polling
  if (ticketsToStore.length > 0) {
    const { error: insertError } = await supabase
      .from('push_notification_tickets')
      .insert(ticketsToStore);
    if (insertError) {
      console.error('Failed to store push tickets:', insertError);
      errors.push(`Ticket storage failed: ${insertError.message}`);
    }
  }

  return { sent, failed, errors };
}

// =============================================================================
// MERCHANT NOTIFICATION EVENT HELPERS
// =============================================================================

/**
 * Notify merchant of a new order.
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
 * Notify merchant of payment received.
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
 * Notify merchant of low stock.
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
 * Notify merchant of a new review.
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
 * Notify merchant of withdrawal processed.
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
 * Notify merchant of a new Jumia order.
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
    'orders'
  );
}

// =============================================================================
// NEGOTIATION NOTIFICATION HELPERS
// =============================================================================

/**
 * Notify merchant of a new price negotiation request.
 *
 * Handles both `type='single'` (single item with name/price) and `type='total'`
 * (cart-level negotiation where `item_info` is null).
 */
export async function notifyNegotiationRequest(
  merchantId: string,
  negotiationType: 'single' | 'total',
  offeredPrice: number,
  negotiationId: string,
  itemName?: string | null,
  currentPrice?: number | null
): Promise<void> {
  const formattedOffer = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(offeredPrice);

  let body: string;
  if (negotiationType === 'total' || !itemName || !currentPrice) {
    body = `Cart total negotiation — ${formattedOffer} offered`;
  } else {
    const discount = Math.round(
      ((currentPrice - offeredPrice) / currentPrice) * 100
    );
    body = `${itemName} — ${formattedOffer} offered (${discount}% off)`;
  }

  await notifyMerchant(
    merchantId,
    '🤝 New Price Negotiation',
    body,
    { type: 'negotiation', negotiation_id: negotiationId },
    'orders'
  );
}

/**
 * Notify customer of a negotiation response (accepted/rejected).
 *
 * Handles both single-item and cart-level negotiations.
 */
export async function notifyNegotiationResponse(
  userId: string,
  negotiationType: 'single' | 'total',
  status: 'accepted' | 'rejected',
  negotiationId: string,
  itemName?: string | null,
  offeredPrice?: number | null
): Promise<void> {
  const isAccepted = status === 'accepted';
  const title = isAccepted ? '✅ Offer Accepted!' : '❌ Offer Declined';

  let body: string;
  if (negotiationType === 'total' || !itemName) {
    body = isAccepted
      ? 'Your cart offer has been accepted! Complete your purchase now.'
      : 'Your cart offer was declined. Try a new offer or buy at the listed price.';
  } else {
    const formattedPrice =
      offeredPrice != null
        ? new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN',
            minimumFractionDigits: 0,
          }).format(offeredPrice)
        : '';

    body = isAccepted
      ? `Your offer${formattedPrice ? ` of ${formattedPrice}` : ''} for ${itemName} has been accepted!`
      : `Your offer for ${itemName} was declined. Try a new offer or buy at the listed price.`;
  }

  await notifyCustomer(
    userId,
    title,
    body,
    {
      type: 'negotiation_response',
      negotiation_id: negotiationId,
      status,
    },
    'orders'
  );
}

// =============================================================================
// CUSTOMER NOTIFICATION EVENT HELPERS (for storefront mobile apps)
// =============================================================================

/**
 * Notify customer of order status change.
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
 * Notify customer of promotional offer.
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
 * Notify customer that a product is back in stock.
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
 * Notify customer of price drop on a wishlisted item.
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
