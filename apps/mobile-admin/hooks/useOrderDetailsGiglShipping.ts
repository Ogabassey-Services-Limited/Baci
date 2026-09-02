import type { Order } from '@baci/shared';
import { useOrderGiglShipping } from '@/hooks/orders/useOrderGiglShipping';
import type { Merchant } from '@/hooks/useMerchant';
import { getOrderGiglShippingVisibility } from '@/lib/order-gigl-shipping-visibility';
import { getOrderGiglInitialAddress } from '@/lib/order-shipment';

interface UseOrderDetailsGiglShippingParams {
  giglEligible: boolean;
  merchant: Merchant | null;
  order: Order | undefined;
  providerLabel: string | null;
  shipmentFlowStep: string;
  showShipmentFlow: boolean;
  userId?: string | null;
}

export function useOrderDetailsGiglShipping({
  giglEligible,
  merchant,
  order,
  providerLabel,
  shipmentFlowStep,
  showShipmentFlow,
  userId,
}: UseOrderDetailsGiglShippingParams) {
  const { isMerchantOwner, providerBookingAvailable } =
    getOrderGiglShippingVisibility({
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
      !providerBookingAvailable,
    initialAddress: order ? getOrderGiglInitialAddress(order) : undefined,
    orderId: order?.id ?? '',
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
