export interface BnplOrderItem {
  name?: string;
  product_name?: string;
  price: number;
  quantity: number;
}

export interface BnplOrder {
  id: string;
  total: number | string;
  shipping_cost?: number | string | null;
  shipping_fee?: number | string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_name?: string | null;
  tracking_token?: string | null;
  items: BnplOrderItem[];
}

export function normalizeKlumpPhone(phone: string | null | undefined) {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.startsWith('234')) {
    const localDigits = digits.slice(3);
    if (localDigits.length === 10) {
      return `0${localDigits}`;
    }
    if (localDigits.length === 11 && localDigits.startsWith('0')) {
      return localDigits;
    }
  }
  if (digits.length === 10) {
    return `0${digits}`;
  }
  if (digits.length === 11) {
    return digits;
  }

  return phone?.trim() || undefined;
}

export function getUnmaskedValue(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed && !trimmed.includes('*')) {
      return trimmed;
    }
  }

  return undefined;
}

export function toCurrencyAmount(value: number | string | null | undefined) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  return Math.round(amount * 100) / 100;
}

export function buildKlumpItems(order: BnplOrder) {
  const items = order.items.map((item) => {
    const quantity = Math.max(1, Number(item.quantity) || 1);
    return {
      name: item.product_name || item.name || 'Order item',
      quantity,
      unit_price: toCurrencyAmount(item.price),
    };
  });
  const itemsTotal = () =>
    items.reduce((total, item) => total + item.unit_price * item.quantity, 0);
  const shippingFee = toCurrencyAmount(
    order.shipping_cost ?? order.shipping_fee
  );

  if (shippingFee > 0) {
    items.push({
      name: 'Delivery',
      quantity: 1,
      unit_price: shippingFee,
    });
  }

  const adjustment = toCurrencyAmount(
    toCurrencyAmount(order.total) - itemsTotal()
  );
  if (adjustment > 0) {
    items.push({
      name: 'Taxes and fees',
      quantity: 1,
      unit_price: adjustment,
    });
  }

  return items;
}
