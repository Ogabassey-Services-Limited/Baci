import { NextResponse } from 'next/server';
import type { GPTTotal } from '@/lib/agentic/checkout';
import { UCP_PROFILE_VERSION } from '@/lib/agentic/ucp-discovery-profile';

const UCP_CHECKOUT_CAPABILITY = 'dev.ucp.shopping.checkout';
const UCP_ORDER_CAPABILITY = 'dev.ucp.shopping.order';
type JsonRecord = Record<string, unknown>;

export function adaptCheckoutResponseToUcp(response: Response) {
  return adaptSuccessfulJsonResponse(response, buildUcpCheckoutResponse);
}

export function adaptOrderResponseToUcp(response: Response) {
  return adaptSuccessfulJsonResponse(response, buildUcpOrderResponse);
}

export function buildUcpCheckoutResponse(response: unknown) {
  if (!isRecord(response)) return response;

  return {
    ...response,
    ucp: {
      version: UCP_PROFILE_VERSION,
      status: 'success',
      capabilities: {
        [UCP_CHECKOUT_CAPABILITY]: [{ version: UCP_PROFILE_VERSION }],
      },
      payment_handlers: {},
    },
    status: mapCheckoutStatus(response.status),
    line_items: Array.isArray(response.line_items)
      ? response.line_items.map((lineItem) => mapCheckoutLineItem(lineItem))
      : [],
    totals: mapCheckoutTotals(response.totals),
  };
}

export function buildUcpOrderResponse(response: unknown) {
  if (!isRecord(response)) return response;

  const orderId = toStringValue(response.id) ?? 'unknown';
  const currency = toStringValue(response.currency)?.toUpperCase() ?? 'NGN';
  const total = toIntegerAmount(response.total);
  const subtotal = toIntegerAmount(response.subtotal) ?? total ?? 0;
  const shippingFee = toIntegerAmount(response.shipping_fee);
  const taxAmount = toIntegerAmount(response.tax_amount);
  const discountAmount = toIntegerAmount(response.discount_amount);
  const shippingStatus = toStringValue(response.shipping_status);
  const fulfillmentEvents = shippingStatus
    ? [
        {
          status: shippingStatus,
          timestamp:
            toStringValue(response.updated_at) ?? new Date(0).toISOString(),
        },
      ]
    : [];

  return {
    ...response,
    ucp: {
      version: UCP_PROFILE_VERSION,
      status: 'success',
      capabilities: {
        [UCP_ORDER_CAPABILITY]: [{ version: UCP_PROFILE_VERSION }],
      },
    },
    checkout_id: toStringValue(response.checkout_id) ?? orderId,
    currency,
    fulfillment: {
      expectations: [],
      events: fulfillmentEvents,
    },
    line_items: Array.isArray(response.order_items)
      ? response.order_items.map((item, index) => mapOrderLineItem(item, index))
      : [],
    permalink_url:
      toStringValue(response.permalink_url) ??
      toStringValue(getRecord(response.links)?.track_order) ??
      '',
    totals: buildOrderTotals({
      discountAmount,
      shippingFee,
      subtotal,
      taxAmount,
      total: total ?? subtotal,
    }),
  };
}

async function adaptSuccessfulJsonResponse(
  response: Response,
  adapter: (body: unknown) => unknown
): Promise<Response> {
  if (response.status < 200 || response.status >= 300) {
    return response;
  }

  let body: unknown;
  try {
    body = await response.clone().json();
  } catch {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('content-type', 'application/json');

  return NextResponse.json(adapter(body), {
    headers,
    status: response.status,
  });
}

function mapCheckoutStatus(status: unknown): string {
  switch (status) {
    case 'not_ready_for_payment':
      return 'incomplete';
    case 'ready_for_payment':
      return 'ready_for_complete';
    case 'payment_pending':
      return 'complete_in_progress';
    case 'completed':
      return 'completed';
    case 'canceled':
      return 'canceled';
    default:
      return 'requires_escalation';
  }
}

function mapCheckoutLineItem(lineItem: unknown) {
  const lineItemRecord = isRecord(lineItem) ? lineItem : {};
  const item = getRecord(lineItemRecord.item);
  const quantity = toPositiveInteger(item?.quantity) ?? 1;
  const lineTotal =
    toIntegerAmount(lineItemRecord.total) ??
    toIntegerAmount(lineItemRecord.subtotal) ??
    toIntegerAmount(lineItemRecord.base_amount) ??
    0;
  const unitPrice =
    quantity > 0
      ? Math.max(0, Math.round(lineTotal / quantity))
      : Math.max(0, lineTotal);

  return {
    ...lineItemRecord,
    id: toStringValue(lineItemRecord.id) ?? 'unknown',
    item: {
      ...(item ?? {}),
      id:
        toStringValue(item?.id) ??
        toStringValue(lineItemRecord.id) ??
        'unknown',
      price: unitPrice,
      title:
        toStringValue(item?.title) ?? toStringValue(item?.id) ?? 'Unknown item',
    },
    quantity,
    totals: [
      {
        amount: Math.max(
          0,
          toIntegerAmount(lineItemRecord.subtotal) ?? lineTotal
        ),
        display_text: 'Subtotal',
        type: 'subtotal',
      },
      {
        amount: Math.max(0, lineTotal),
        display_text: 'Total',
        type: 'total',
      },
    ],
  };
}

function mapCheckoutTotals(totals: unknown): unknown[] {
  const sourceTotals = Array.isArray(totals) ? (totals as GPTTotal[]) : [];
  const mappedTotals = sourceTotals
    .map((total) => ({
      ...total,
      amount: toIntegerAmount(total.amount) ?? 0,
      type: total.type === 'items_base_amount' ? 'subtotal' : total.type,
    }))
    .filter((total) => total.type !== 'items_discount' || total.amount < 0);
  const hasSubtotal = mappedTotals.some((total) => total.type === 'subtotal');
  const hasTotal = mappedTotals.some((total) => total.type === 'total');

  if (!hasSubtotal) {
    mappedTotals.unshift({
      amount: 0,
      display_text: 'Subtotal',
      type: 'subtotal',
    });
  }
  if (!hasTotal) {
    mappedTotals.push({ amount: 0, display_text: 'Total', type: 'total' });
  }

  return mappedTotals;
}

function mapOrderLineItem(orderItem: unknown, index: number) {
  const orderItemRecord = isRecord(orderItem) ? orderItem : {};
  const quantity = toPositiveInteger(orderItemRecord.quantity) ?? 1;
  const price = Math.max(0, toIntegerAmount(orderItemRecord.price) ?? 0);
  const total =
    toIntegerAmount(orderItemRecord.line_extension_amount) ?? price * quantity;
  const itemId =
    toStringValue(orderItemRecord.variant_id) ??
    toStringValue(orderItemRecord.product_id) ??
    toStringValue(orderItemRecord.id) ??
    `line_${index + 1}`;

  return {
    id: toStringValue(orderItemRecord.id) ?? `line_${index + 1}`,
    item: {
      id: itemId,
      price,
      title: toStringValue(orderItemRecord.name) ?? 'Unknown item',
    },
    quantity: {
      fulfilled: 0,
      total: quantity,
    },
    status: 'processing',
    totals: [
      {
        amount: Math.max(0, total),
        display_text: 'Total',
        type: 'total',
      },
    ],
  };
}

function buildOrderTotals({
  discountAmount,
  shippingFee,
  subtotal,
  taxAmount,
  total,
}: {
  discountAmount?: number | null;
  shippingFee?: number | null;
  subtotal: number;
  taxAmount?: number | null;
  total: number;
}) {
  return [
    {
      amount: Math.max(0, subtotal),
      display_text: 'Subtotal',
      type: 'subtotal',
    },
    ...(shippingFee && shippingFee > 0
      ? [{ amount: shippingFee, display_text: 'Shipping', type: 'fulfillment' }]
      : []),
    ...(taxAmount && taxAmount > 0
      ? [{ amount: taxAmount, display_text: 'Tax', type: 'tax' }]
      : []),
    ...(discountAmount && discountAmount > 0
      ? [
          {
            amount: -Math.abs(discountAmount),
            display_text: 'Discount',
            type: 'discount',
          },
        ]
      : []),
    { amount: Math.max(0, total), display_text: 'Total', type: 'total' },
  ];
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getRecord(value: unknown): JsonRecord | null {
  return isRecord(value) ? value : null;
}

function toStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function toIntegerAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric) : null;
}

function toPositiveInteger(value: unknown): number | null {
  const amount = toIntegerAmount(value);
  return amount && amount > 0 ? amount : null;
}
