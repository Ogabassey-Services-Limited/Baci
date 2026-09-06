import { canUseSelectedShippingProvider } from './order-shipment';

interface OrderGiglShippingVisibilityInput {
  merchantOwnerId?: string | null;
  order?: {
    selected_quote_id?: string | null;
    shipment_id?: string | null;
    shipping_funding_source?: 'customer_checkout' | 'merchant_wallet' | null;
    shipping_provider?: string | null;
    tracking_number?: string | null;
  } | null;
  userId?: string | null;
}

export function getOrderGiglShippingVisibility({
  merchantOwnerId,
  order,
  userId,
}: OrderGiglShippingVisibilityInput) {
  const isMerchantOwner = Boolean(
    userId && merchantOwnerId && userId === merchantOwnerId
  );
  const isSavedMerchantWalletGiglOrder = Boolean(
    order?.shipping_provider?.trim().toUpperCase() === 'GIGL' &&
      order.shipping_funding_source === 'merchant_wallet' &&
      order.selected_quote_id
  );
  // Keep merchant-wallet GIGL bookings on the bound quote so recovery can
  // reach the existing reservation instead of forcing a replacement quote.
  const providerBookingAvailable = order
    ? canUseSelectedShippingProvider(order)
    : false;

  return {
    isMerchantOwner,
    isSavedMerchantWalletGiglOrder,
    providerBookingAvailable,
  };
}
