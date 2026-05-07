import {
  getFirstNonBlankString,
  type Order,
  type OrderFulfillmentDetails,
  type OrderItem,
} from '@baci/shared';

export type ShipmentCompletionMode = 'provider' | 'self_fulfillment';
export type ShipmentFlowStep = 'details' | 'method' | 'rider';

const DEVICE_KEYWORDS = [
  'alienware',
  'dell',
  'gaming',
  'hp',
  'iphone',
  'laptop',
  'phone',
  'samsung',
];
const KNOWN_PROVIDER_LABELS: Record<string, string> = {
  GIGL: 'GIG Logistics',
  SHIIP: 'Shiip',
  TOPSHIP: 'Topship',
};

export function orderRequiresFulfillment(
  items: OrderItem[] | undefined
): boolean {
  return (
    items?.some(
      (item) =>
        item.has_assurance === true ||
        DEVICE_KEYWORDS.some((keyword) =>
          item.name?.toLowerCase().includes(keyword)
        )
    ) ?? false
  );
}

export function canUseSelectedShippingProvider(
  order: Pick<
    Order,
    | 'selected_quote_id'
    | 'shipment_id'
    | 'shipping_provider'
    | 'tracking_number'
  >
): boolean {
  return Boolean(
    order.shipping_provider &&
      order.selected_quote_id &&
      !order.tracking_number &&
      !order.shipment_id
  );
}

export function formatShippingProviderName(
  provider: string | null | undefined
): string | null {
  if (!provider) {
    return null;
  }

  const normalized = provider.trim();
  if (!normalized) {
    return null;
  }

  return (
    KNOWN_PROVIDER_LABELS[normalized.toUpperCase()] ??
    normalized
      .toLowerCase()
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  );
}

export function getInitialFulfillmentDetails(
  details: OrderFulfillmentDetails | null | undefined
): {
  imei: string;
  serialNumber: string;
} {
  return {
    imei: getFirstNonBlankString(details?.imei),
    serialNumber: getFirstNonBlankString(
      details?.serialNumber,
      details?.serial_number
    ),
  };
}

export function shouldPersistFulfillmentDetails(details: {
  imei: string;
  serialNumber: string;
}): boolean {
  return Boolean(details.imei.trim() || details.serialNumber.trim());
}

export function getDispatchPhoneFromOrder(
  order: Pick<Order, 'self_fulfillment_data'>
): string {
  return order.self_fulfillment_data?.dispatchPhone?.trim() ?? '';
}
