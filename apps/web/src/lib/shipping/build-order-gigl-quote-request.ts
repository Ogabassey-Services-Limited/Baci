import type { QuoteRequest, ShipmentItem, ShippingAddress } from './types';

type OrderItem = {
  name?: string | null;
  quantity?: number | null;
  price?: number | null;
  product_id?: string | null;
  weight_value?: number | null;
  weight_unit?: string | null;
};
type OrderLike = {
  id: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  shipping_address?: unknown;
  order_items?: OrderItem[] | null;
};
type ProductLookup = (
  ids: string[]
) => Promise<
  Record<string, { weight_value?: number | null; weight_unit?: string | null }>
>;

export type OrderGiglQuoteBuildResult =
  | { ok: true; request: QuoteRequest }
  | {
      ok: false;
      code:
        | 'ORDER_SHIPPING_ADDRESS_INCOMPLETE'
        | 'ORDER_SHIPPING_ITEMS_EMPTY'
        | 'ORDER_SHIPPING_ITEM_INVALID';
      missing?: string[];
      status: number;
    };

function weightKg(value: unknown, unit: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const u = String(unit ?? 'kg').toLowerCase();
  if (u !== 'kg' && u !== 'g') return null;
  const factor = u === 'g' ? 0.001 : 1;
  return n * factor;
}

function readAddress(raw: unknown, order: OrderLike): ShippingAddress {
  const a =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    name: String(a.name ?? order.customer_name ?? ''),
    phone: String(a.phone ?? order.customer_phone ?? ''),
    email: String(a.email ?? order.customer_email ?? ''),
    address: String(a.address ?? a.street ?? ''),
    city: String(a.city ?? ''),
    state: String(a.state ?? ''),
    country: String(a.country ?? 'Nigeria'),
    countryCode: String(a.countryCode ?? a.country_code ?? 'NG'),
    postalCode: typeof a.postalCode === 'string' ? a.postalCode : undefined,
  };
}

export async function buildOrderGiglQuoteRequest(
  order: OrderLike,
  sender: ShippingAddress,
  lookupProducts: ProductLookup = async () => ({}),
  receiverOverride?: Partial<ShippingAddress>
): Promise<OrderGiglQuoteBuildResult> {
  const receiver = {
    ...readAddress(order.shipping_address, order),
    ...receiverOverride,
  };
  const required = ['address', 'city', 'state', 'phone'] as const;
  const missing = required.filter((key) => !String(receiver[key] ?? '').trim());
  if (missing.length)
    return {
      ok: false,
      code: 'ORDER_SHIPPING_ADDRESS_INCOMPLETE',
      missing,
      status: 422,
    };
  const rows = order.order_items ?? [];
  if (!rows.length)
    return { ok: false, code: 'ORDER_SHIPPING_ITEMS_EMPTY', status: 400 };
  const ids = rows.flatMap((item) =>
    item.product_id ? [item.product_id] : []
  );
  const products = await lookupProducts(ids);
  const items: ShipmentItem[] = [];
  for (const item of rows) {
    const quantity = Number(item.quantity ?? 1);
    if (
      !Number.isInteger(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(quantity)
    )
      return { ok: false, code: 'ORDER_SHIPPING_ITEM_INVALID', status: 400 };
    const product = item.product_id ? products[item.product_id] : undefined;
    const weight =
      weightKg(item.weight_value, item.weight_unit) ??
      weightKg(product?.weight_value, product?.weight_unit) ??
      1;
    items.push({
      name: String(item.name ?? 'Item'),
      quantity,
      weight,
      value: Number(item.price ?? 0),
    });
  }
  return {
    ok: true,
    request: {
      sessionId: order.id,
      sender,
      receiver,
      items,
      shipmentType: 'domestic',
      deliveryPreference: 'door',
    },
  };
}
