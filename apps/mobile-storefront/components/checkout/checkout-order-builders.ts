import {
  PICKUP_STATION_ADDRESS_LINES,
  PICKUP_STATION_CITY,
  PICKUP_STATION_STATE,
} from '@/components/checkout/PickupStationCard';
import type {
  DeliveryMethod,
  ShippingQuote,
} from '@/components/checkout/types';
import { getCartItemEffectivePrice } from '@/lib/cart-pricing';
import type { MobileCheckoutOrderItemPayload } from '@/lib/checkout-order-idempotency';
import type { ShippingAddressInput } from '@/lib/validation';
import type { CreateOrderRequest } from '@/services/orders';
import type { CartItem } from '@/stores/cart-store';

export interface CheckoutSnapshot {
  assuranceFee: number;
  deliveryFee: number;
  subtotal: number;
  taxAmount: number;
  total: number;
}

interface BuildOrderRequestParams {
  address: ShippingAddressInput;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  deliveryMethod: DeliveryMethod;
  discountCode?: string | null;
  itemsSnapshot: CartItem[];
  paymentMethodForOrder: string;
  selectedQuote: ShippingQuote | undefined;
  shippingProvider: string | undefined;
  snapshot: CheckoutSnapshot;
}

type CheckoutOrderRequest = Omit<CreateOrderRequest, 'items'> & {
  items: MobileCheckoutOrderItemPayload[];
};

export function createCheckoutSnapshot(
  itemsSnapshot: CartItem[],
  deliveryFee: number,
  taxAmount: number
): CheckoutSnapshot {
  const subtotal = itemsSnapshot.reduce((total, item) => {
    const effectivePrice = getCartItemEffectivePrice(item);
    return total + effectivePrice * item.quantity;
  }, 0);
  const assuranceFee = calculateCheckoutAssuranceFee(itemsSnapshot);
  return {
    assuranceFee,
    deliveryFee,
    subtotal,
    taxAmount,
    total: subtotal + deliveryFee + assuranceFee + taxAmount,
  };
}

export function calculateCheckoutAssuranceFee(itemsSnapshot: CartItem[]) {
  return itemsSnapshot.reduce((sum, item) => {
    if (!item.hasAssurance) return sum;
    const effectivePrice = getCartItemEffectivePrice(item);
    return (
      sum +
      Math.round(effectivePrice * item.quantity * (item.assuranceRate ?? 0.05))
    );
  }, 0);
}

export function buildOrderShippingAddress(
  address: ShippingAddressInput,
  deliveryMethod: DeliveryMethod
): ShippingAddressInput {
  if (deliveryMethod === 'pickup_station') {
    return {
      ...address,
      address: PICKUP_STATION_ADDRESS_LINES.join(', '),
      city: PICKUP_STATION_CITY,
      state: PICKUP_STATION_STATE,
    };
  }

  if (deliveryMethod === 'airport') {
    return {
      ...address,
      address: address.address || 'Airport Delivery (Outside Lagos)',
    };
  }

  return address;
}

export function mapCartItemsToOrderItems(
  itemsSnapshot: CartItem[]
): MobileCheckoutOrderItemPayload[] {
  return itemsSnapshot.map((item) => {
    const effectivePrice = getCartItemEffectivePrice(item);
    return {
      id: item.product_id,
      product_id: item.product_id,
      name: item.name,
      quantity: item.quantity,
      price: effectivePrice,
      image_url: item.image_url,
      variant_id: item.variant_id,
      variant_attributes: item.variant_attributes,
      has_assurance: item.hasAssurance || false,
      assurance_fee: item.hasAssurance
        ? Math.round(
            effectivePrice * item.quantity * (item.assuranceRate ?? 0.05)
          )
        : 0,
    };
  });
}

export function buildCheckoutOrderRequest({
  address,
  customerEmail,
  customerName,
  customerPhone,
  deliveryMethod,
  discountCode,
  itemsSnapshot,
  paymentMethodForOrder,
  selectedQuote,
  shippingProvider,
  snapshot,
}: BuildOrderRequestParams): CheckoutOrderRequest {
  return {
    customer_email: customerEmail,
    customer_name: customerName,
    customer_phone: customerPhone,
    items: mapCartItemsToOrderItems(itemsSnapshot),
    subtotal: snapshot.subtotal,
    shipping_fee: snapshot.deliveryFee,
    tax_amount: snapshot.taxAmount,
    selected_quote_id:
      deliveryMethod === 'door' && selectedQuote?.id != null
        ? String(selectedQuote.id)
        : undefined,
    shipping_provider: shippingProvider,
    payment_method: paymentMethodForOrder,
    shipping_address: buildOrderShippingAddress(address, deliveryMethod),
    // Intentionally omit expected_total/client_total here: the web order API
    // derives and validates the final payable total at the tax boundary.
    source: 'mobile_app',
    // Only the trusted code string; the route recomputes + validates the amount.
    ...(discountCode ? { discount_code: discountCode } : {}),
  };
}
