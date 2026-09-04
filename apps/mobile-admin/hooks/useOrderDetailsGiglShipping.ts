import type { Order } from '@baci/shared';
import { useOrderGiglShipping } from '@/hooks/orders/useOrderGiglShipping';
import type { Merchant } from '@/hooks/useMerchant';
import { getOrderGiglShippingVisibility } from '@/lib/order-gigl-shipping-visibility';
import {
  getOrderGiglInitialAddress,
  type ShipmentCompletionMode,
} from '@/lib/order-shipment';

interface UseOrderDetailsGiglShippingParams {
  giglEligible: boolean;
  merchant: Merchant | null;
  order: Order | undefined;
  pendingShipmentMode: ShipmentCompletionMode;
  providerLabel: string | null;
  shipmentFlowStep: string;
  showShipmentFlow: boolean;
  userId?: string | null;
}

export function useOrderDetailsGiglShipping({
  giglEligible,
  merchant,
  order,
  pendingShipmentMode,
  providerLabel,
  shipmentFlowStep,
  showShipmentFlow,
  userId,
}: UseOrderDetailsGiglShippingParams) {
  const {
    isMerchantOwner,
    isSavedMerchantWalletGiglOrder,
    providerBookingAvailable,
  } = getOrderGiglShippingVisibility({
    merchantOwnerId: merchant?.user_id,
    order,
    userId,
  });
  const giglShippingState = useOrderGiglShipping({
    enabled:
      isMerchantOwner &&
      giglEligible &&
      showShipmentFlow &&
      shipmentFlowStep === 'method' &&
      (!providerBookingAvailable || isSavedMerchantWalletGiglOrder),
    initialAddress: order ? getOrderGiglInitialAddress(order) : undefined,
    orderId: order?.id ?? '',
    preview: pendingShipmentMode !== 'provider',
  });
  const giglShipping =
    isMerchantOwner && giglEligible ? giglShippingState : undefined;

  return {
    effectiveProviderLabel:
      providerLabel || (giglShipping?.quote ? 'GIG Logistics' : null),
    giglShipping,
    isMerchantOwner,
    providerBookingAvailable,
  };
}
