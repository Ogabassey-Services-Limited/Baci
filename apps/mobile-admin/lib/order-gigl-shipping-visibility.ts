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
  const providerBookingAvailable = order
    ? canUseSelectedShippingProvider(order) && !isSavedMerchantWalletGiglOrder
    : false;

  return {
    isMerchantOwner,
    isSavedMerchantWalletGiglOrder,
    providerBookingAvailable,
  };
}
