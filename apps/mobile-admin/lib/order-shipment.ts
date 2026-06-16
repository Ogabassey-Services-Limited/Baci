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
  'airpod',
  'audio',
  'camera',
  'computer',
  'console',
  'dell',
  'drone',
  'earbud',
  'gaming',
  'headphone',
  'hp',
  'ipad',
  'iphone',
  'laptop',
  'macbook',
  'phone',
  'playstation',
  'samsung',
  'speaker',
  'tablet',
  'watch',
  'wearable',
  'xbox',
];
const IDENTIFIER_TRACKED_BUSINESS_TYPE_KEYWORDS = ['electronics', 'gadget'];
const IDENTIFIER_TRACKED_CATEGORY_KEYWORDS = [
  'accessor',
  'audio',
  'camera',
  'computer',
  'console',
  'device',
  'drone',
  'earbud',
  'electronics',
  'gadget',
  'gaming',
  'headphone',
  'laptop',
  'phone',
  'smartphone',
  'speaker',
  'tablet',
  'watch',
  'wearable',
];
const KNOWN_PROVIDER_LABELS: Record<string, string> = {
  GIGL: 'GIG Logistics',
  SHIIP: 'Shiip',
  TOPSHIP: 'Topship',
};

function normalizeIdentifierText(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function containsAnyIdentifierKeyword(
  values: Array<string | null | undefined>,
  keywords: string[]
): boolean {
  return values.some((value) => {
    const normalizedValue = normalizeIdentifierText(value);
    return (
      normalizedValue.length > 0 &&
      keywords.some((keyword) => normalizedValue.includes(keyword))
    );
  });
}

function isIdentifierTrackedBusinessType(
  businessType: string | null | undefined
): boolean {
  return containsAnyIdentifierKeyword(
    [businessType],
    IDENTIFIER_TRACKED_BUSINESS_TYPE_KEYWORDS
  );
}

function itemRequiresIdentifier(item: OrderItem): boolean {
  return (
    containsAnyIdentifierKeyword(
      [item.name, item.product_name],
      DEVICE_KEYWORDS
    ) ||
    containsAnyIdentifierKeyword(
      [item.category, item.category_slug],
      IDENTIFIER_TRACKED_CATEGORY_KEYWORDS
    )
  );
}

export function orderRequiresFulfillment(
  items: OrderItem[] | undefined,
  merchantBusinessType?: string | null
): boolean {
  const merchantRequiresIdentifiers =
    isIdentifierTrackedBusinessType(merchantBusinessType);

  return (
    items?.some(
      (item) =>
        item.has_assurance === true ||
        merchantRequiresIdentifiers ||
        itemRequiresIdentifier(item)
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
