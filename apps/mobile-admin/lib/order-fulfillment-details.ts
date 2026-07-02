import {
  getFirstNonBlankString,
  type OrderFulfillmentDetails,
  type OrderItem,
} from '@baci/shared';

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

export interface ShipmentFulfillmentItem {
  id: string;
  imei: string;
  orderItemId: string;
  productName: string;
  serialNumber: string;
  unitCount: number;
  unitIndex: number;
  variantName?: string | null;
}

export interface ShipmentFulfillmentDetails {
  imei: string;
  items: ShipmentFulfillmentItem[];
  serialNumber: string;
}
type PersistedFulfillmentItem = NonNullable<
  OrderFulfillmentDetails['items']
>[number];

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

function getPositiveUnitCount(quantity: number | null | undefined): number {
  const normalizedQuantity = Math.floor(Number(quantity) || 0);
  return Math.max(normalizedQuantity, 1);
}

export function getOrderFulfillmentIdentifierItems(
  items: OrderItem[] | undefined,
  merchantBusinessType?: string | null
): ShipmentFulfillmentItem[] {
  const merchantRequiresIdentifiers =
    isIdentifierTrackedBusinessType(merchantBusinessType);

  return (items ?? []).flatMap((item) => {
    const requiresIdentifier =
      item.has_assurance === true ||
      merchantRequiresIdentifiers ||
      itemRequiresIdentifier(item);

    if (!requiresIdentifier) {
      return [];
    }

    const productName = item.product_name || item.name || 'Item';
    const unitCount = getPositiveUnitCount(item.quantity);

    return Array.from({ length: unitCount }, (_, index) => ({
      id: `${item.id}:${index + 1}`,
      imei: '',
      orderItemId: item.id,
      productName,
      serialNumber: '',
      unitCount,
      unitIndex: index,
      variantName: item.variant_name ?? null,
    }));
  });
}

function getExistingItemValue(
  item: PersistedFulfillmentItem | undefined,
  field: 'imei' | 'serialNumber'
): string {
  if (!item) {
    return '';
  }

  if (field === 'imei') {
    return getFirstNonBlankString(item.imei);
  }

  return getFirstNonBlankString(item.serialNumber, item.serial_number);
}

function findExistingFulfillmentItem(
  details: OrderFulfillmentDetails | null | undefined,
  item: ShipmentFulfillmentItem
) {
  const existingItems = Array.isArray(details?.items) ? details.items : [];

  return existingItems.find((existingItem) => {
    const existingId = getFirstNonBlankString(existingItem.id);
    if (existingId && existingId === item.id) {
      return true;
    }

    const existingOrderItemId = getFirstNonBlankString(
      existingItem.orderItemId,
      existingItem.order_item_id
    );
    const existingUnitIndex =
      typeof existingItem.unitIndex === 'number'
        ? existingItem.unitIndex
        : existingItem.unit_index;

    return (
      existingOrderItemId === item.orderItemId &&
      existingUnitIndex === item.unitIndex
    );
  });
}

export function getInitialFulfillmentDetails(
  details: OrderFulfillmentDetails | null | undefined,
  requiredItems: ShipmentFulfillmentItem[] = []
): ShipmentFulfillmentDetails {
  const orderLevelImei = getFirstNonBlankString(details?.imei);
  const orderLevelSerialNumber = getFirstNonBlankString(
    details?.serialNumber,
    details?.serial_number
  );

  const items = requiredItems.map((item, index) => {
    const existingItem = findExistingFulfillmentItem(details, item);

    return {
      ...item,
      imei:
        getExistingItemValue(existingItem, 'imei') ||
        (index === 0 ? orderLevelImei : ''),
      serialNumber:
        getExistingItemValue(existingItem, 'serialNumber') ||
        (index === 0 ? orderLevelSerialNumber : ''),
    };
  });

  return {
    imei: items[0]?.imei ?? orderLevelImei,
    items,
    serialNumber: items[0]?.serialNumber ?? orderLevelSerialNumber,
  };
}

export function shouldPersistFulfillmentDetails(
  details: ShipmentFulfillmentDetails
): boolean {
  return Boolean(
    details.imei.trim() ||
      details.serialNumber.trim() ||
      details.items.some((item) => item.imei.trim() || item.serialNumber.trim())
  );
}

export function getFirstIncompleteFulfillmentItemIndex(
  details: ShipmentFulfillmentDetails
): number {
  return details.items.findIndex(
    (item) => !(item.imei.trim() || item.serialNumber.trim())
  );
}

export function areFulfillmentDetailsComplete(
  details: ShipmentFulfillmentDetails
): boolean {
  if (details.items.length === 0) {
    return shouldPersistFulfillmentDetails(details);
  }

  return getFirstIncompleteFulfillmentItemIndex(details) === -1;
}

export function updateShipmentFulfillmentDetails(
  details: ShipmentFulfillmentDetails,
  itemIndex: number,
  field: 'imei' | 'serialNumber',
  value: string
): ShipmentFulfillmentDetails {
  if (!details.items[itemIndex]) {
    return { ...details, [field]: value };
  }

  const items = details.items.map((item, index) =>
    index === itemIndex ? { ...item, [field]: value } : item
  );
  const firstFilledItem = items.find(
    (item) => item.imei.trim() || item.serialNumber.trim()
  );

  return {
    imei: firstFilledItem?.imei ?? '',
    items,
    serialNumber: firstFilledItem?.serialNumber ?? '',
  };
}

export function buildOrderFulfillmentDetailsForPersistence(
  details: ShipmentFulfillmentDetails
): OrderFulfillmentDetails {
  const items = details.items.map((item) => ({
    id: item.id,
    imei: item.imei.trim() || null,
    orderItemId: item.orderItemId,
    productName: item.productName,
    serialNumber: item.serialNumber.trim() || null,
    unitCount: item.unitCount,
    unitIndex: item.unitIndex,
    variantName: item.variantName ?? null,
  }));
  const firstFilledItem = items.find((item) => item.imei || item.serialNumber);

  return {
    imei: (firstFilledItem?.imei ?? details.imei.trim()) || null,
    items: items.length > 0 ? items : undefined,
    serialNumber:
      (firstFilledItem?.serialNumber ?? details.serialNumber.trim()) || null,
  };
}
