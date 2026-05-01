import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgenticCheckoutBuyer } from '@/lib/agentic/checkout-completion-response';
import { sendAgenticWebhook } from '@/lib/agentic/webhooks';
import { logger } from '@/lib/logger';
import { sanitizeForLog } from '@/lib/sanitize-core';
import { orderCreateSchema } from '@/schemas/orders';

const CLIENT_ORDER_ERROR_CODES = new Set([
  'invalid_items',
  'invalid_quantity',
  'invalid_variant',
  'insufficient_stock',
  'insufficient_variant_stock',
  'merchant_not_found',
  'customer_email_required',
  'customer_name_required',
  'items_required',
  'user_id_mismatch',
  'invalid_payment_status',
  'discount_amount_not_supported',
  '22P02',
]);

export interface AgenticCheckoutOrderResult {
  data: Record<string, unknown>;
  error?: string;
  ok: boolean;
  orderId?: string;
  status: number;
  statusText: string;
}

export async function createAgenticCheckoutOrder(
  orderPayload: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<AgenticCheckoutOrderResult> {
  const parseResult = orderCreateSchema.safeParse(orderPayload);
  if (!parseResult.success) {
    return {
      data: { error: 'Invalid request data' },
      error: 'Invalid request data',
      ok: false,
      orderId: undefined,
      status: 400,
      statusText: 'Bad Request',
    };
  }

  const body = parseResult.data;
  const orderItemsPayload = body.items.map((item) => {
    const itemPrice = item.negotiatedPrice ?? item.price;
    const hasAssurance = item.has_assurance || false;

    return {
      assurance_fee: hasAssurance ? calculateAssuranceFee(itemPrice) : 0,
      condition: item.condition,
      has_assurance: hasAssurance,
      image_url: item.imageUrl ?? item.image_url ?? null,
      product_id: item.product_id || item.productId || item.id,
      quantity: item.quantity,
      variant_attributes:
        item.variantAttributes || item.variant_attributes || {},
      variant_id: item.variantId || item.variant_id,
    };
  });

  if (orderItemsPayload.some((item) => !item.product_id)) {
    return {
      data: { error: 'Invalid order items' },
      error: 'Invalid order items',
      ok: false,
      orderId: undefined,
      status: 400,
      statusText: 'Bad Request',
    };
  }

  const { data: orderRows, error: orderError } = await supabase.rpc(
    'create_storefront_order',
    {
      p_ad_tracking: body.ad_tracking ?? null,
      p_customer_email: body.customer_email,
      p_customer_name: body.customer_name,
      p_customer_phone: body.customer_phone ?? null,
      p_discount_amount: body.discount_amount,
      p_items: orderItemsPayload,
      p_merchant_id: body.merchant_id,
      p_notes: body.notes ?? null,
      p_payment_method: body.payment_method,
      p_payment_status: body.payment_status,
      p_selected_quote_id: body.selected_quote_id || null,
      p_shipping_address: body.shipping_address || null,
      p_shipping_fee: body.shipping_fee,
      p_shipping_provider: body.shipping_provider ?? null,
      p_shipping_status: body.shipping_status,
      p_source: body.source,
      p_tax_amount: body.tax_amount,
      p_tracking_number: body.tracking_number ?? null,
      // Agentic checkout is API-key scoped, not tied to a customer auth session.
      p_user_id: null,
    }
  );

  const order = Array.isArray(orderRows) ? orderRows[0] : orderRows;
  if (orderError || !order) {
    const code = typeof orderError?.code === 'string' ? orderError.code : null;
    const message =
      typeof orderError?.message === 'string'
        ? orderError.message
        : code || 'Failed to create order';
    const isClientError =
      (code ? CLIENT_ORDER_ERROR_CODES.has(code) : false) ||
      CLIENT_ORDER_ERROR_CODES.has(message);
    const safeError = isClientError
      ? (code ?? message)
      : 'Unable to create order';

    logger.error({
      code,
      error: sanitizeForLog(orderError),
      message: 'Agentic checkout order RPC failed',
    });

    return {
      data: { details: safeError, error: 'Failed to create order' },
      error: safeError,
      ok: false,
      orderId: undefined,
      status: isClientError ? 400 : 500,
      statusText: isClientError ? 'Bad Request' : 'Internal Server Error',
    };
  }

  const orderId = typeof order.id === 'string' ? order.id : undefined;
  const amountDueToGateway = toFiniteAmount(order.total);
  if (!isFiniteAmountLike(order.total)) {
    logger.error({
      message: 'Agentic checkout order returned invalid total',
      orderId,
      total: sanitizeForLog(order.total),
    });
  }
  const data = {
    amountDueToGateway,
    order,
    wallet: null,
  };

  return {
    data,
    error: undefined,
    ok: true,
    orderId: getCreatedOrderId(data),
    status: 201,
    statusText: 'Created',
  };
}

export function sendAgenticOrderCreatedWebhook({
  buyer,
  currency,
  orderId,
  sessionId,
  total,
}: {
  buyer: AgenticCheckoutBuyer;
  currency: string;
  orderId: string;
  sessionId: string;
  total?: number | string;
}) {
  sendAgenticWebhook('order.created', {
    id: orderId,
    currency,
    total,
    status: 'pending',
    buyer,
  }).catch((err) =>
    logger.error({
      message: 'Webhook trigger failed',
      error: err,
      sessionId,
    })
  );
}

export async function markAgenticCheckoutOrderCanceled({
  merchantId,
  orderId,
  sessionId,
  supabase,
}: {
  merchantId: string;
  orderId: string;
  sessionId: string;
  supabase: SupabaseClient;
}) {
  const { data, error } = await supabase
    .from('orders')
    .update({
      payment_status: 'cancelled',
      shipping_status: 'cancelled',
      notes: `Agentic checkout session ${sessionId} failed before payment state finalization.`,
    })
    .eq('id', orderId)
    .eq('merchant_id', merchantId)
    .select('id')
    .maybeSingle();

  return { error, updated: !error && !!data };
}

function calculateAssuranceFee(itemPrice: number) {
  return Math.round(itemPrice * 0.05 * 100) / 100;
}

function isFiniteAmountLike(value: unknown) {
  return (
    value !== null && value !== undefined && Number.isFinite(Number(value))
  );
}

function toFiniteAmount(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function getCreatedOrderId(data: Record<string, unknown>) {
  const order = data.order;
  if (order && typeof order === 'object' && 'id' in order) {
    const id = (order as { id?: unknown }).id;
    return typeof id === 'string' ? id : undefined;
  }

  return typeof data.id === 'string' ? data.id : undefined;
}
