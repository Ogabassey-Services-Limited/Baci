export interface OrderData {
  order_id?: string;
  order_number?: string;
  shipping: {
    firstName: string;
    lastName: string;
    email: string;
    address: string;
    city: string;
    state: string;
  };
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    image: string;
  }>;
  subtotal?: number;
  shipping_fee?: number;
  total?: number;
}

type OrderItem = OrderData['items'][number];
type ShippingDetails = OrderData['shipping'];

const EMPTY_ORDER_SNAPSHOT = '';
const LAST_ORDER_CHANGED_EVENT = 'lastOrder:changed';
const LAST_ORDER_STORAGE_KEY = 'lastOrder';
const noop = () => undefined;

export function notifyLastOrderSnapshotChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(LAST_ORDER_CHANGED_EVENT));
}

export function subscribeToLastOrderSnapshot(onStoreChange: () => void) {
  if (typeof window === 'undefined') return noop;

  const handleStorage = (event: StorageEvent) => {
    if (event.key === LAST_ORDER_STORAGE_KEY || event.key === null) {
      onStoreChange();
    }
  };
  const handleSameTabChange = () => {
    onStoreChange();
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(LAST_ORDER_CHANGED_EVENT, handleSameTabChange);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(LAST_ORDER_CHANGED_EVENT, handleSameTabChange);
  };
}

export function getLastOrderSnapshot() {
  if (typeof sessionStorage === 'undefined') return EMPTY_ORDER_SNAPSHOT;

  try {
    return (
      sessionStorage.getItem(LAST_ORDER_STORAGE_KEY) ?? EMPTY_ORDER_SNAPSHOT
    );
  } catch {
    return EMPTY_ORDER_SNAPSHOT;
  }
}

export function getServerLastOrderSnapshot() {
  return EMPTY_ORDER_SNAPSHOT;
}

export function parseOrderSnapshot(snapshot: string): OrderData | null {
  if (!snapshot) return null;

  try {
    const parsed = JSON.parse(snapshot) as unknown;
    if (!isOrderData(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isOrderData(value: unknown): value is OrderData {
  if (!isRecord(value)) return false;
  if (!isShippingDetails(value.shipping)) return false;
  if (!Array.isArray(value.items) || !value.items.every(isOrderItem)) {
    return false;
  }

  return (
    isOptionalString(value.order_id) &&
    isOptionalString(value.order_number) &&
    isOptionalNumber(value.subtotal) &&
    isOptionalNumber(value.shipping_fee) &&
    isOptionalNumber(value.total)
  );
}

function isOrderItem(value: unknown): value is OrderItem {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isNonNegativeNumber(value.price) &&
    isPositiveInteger(value.quantity) &&
    isNonEmptyString(value.image)
  );
}

function isShippingDetails(value: unknown): value is ShippingDetails {
  return (
    isRecord(value) &&
    isNonEmptyString(value.firstName) &&
    isNonEmptyString(value.lastName) &&
    isNonEmptyString(value.email) &&
    isNonEmptyString(value.address) &&
    isNonEmptyString(value.city) &&
    isNonEmptyString(value.state)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isPositiveNumber(value) && Number.isInteger(value);
}

function isOptionalNumber(value: unknown) {
  return value === undefined || isFiniteNumber(value);
}

function isOptionalString(value: unknown) {
  return value === undefined || typeof value === 'string';
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
