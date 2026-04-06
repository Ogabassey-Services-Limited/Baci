/**
 * Negotiation push notification helpers.
 *
 * Extracted from expo-push.ts to respect the one-utility-per-file convention.
 */

import {
  formatCurrency,
  notifyCustomer,
  notifyMerchant,
} from '@/lib/expo-push';

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
  const formattedOffer = formatCurrency(offeredPrice);

  let body: string;
  if (negotiationType === 'total' || !itemName || currentPrice == null) {
    body = `Cart total negotiation — ${formattedOffer} offered`;
  } else {
    const discount =
      currentPrice > 0
        ? Math.round(((currentPrice - offeredPrice) / currentPrice) * 100)
        : 0;
    body =
      discount > 0
        ? `${itemName} — ${formattedOffer} offered (${discount}% off)`
        : `${itemName} — ${formattedOffer} offered`;
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
  offeredPrice?: number | null,
  _productSlug?: string | null
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
      offeredPrice != null ? formatCurrency(offeredPrice) : '';

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
      ...(_productSlug ? { product_slug: _productSlug } : {}),
    },
    'orders'
  );
}
