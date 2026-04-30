import type { SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { POST as createOrder } from '@/app/api/orders/route';
import type { AgenticCheckoutBuyer } from '@/lib/agentic/checkout-completion-response';
import { sendAgenticWebhook } from '@/lib/agentic/webhooks';
import { logger } from '@/lib/logger';

const AGENTIC_INTERNAL_HEADER = 'x-agentic-internal';
const ORDERS_API_PATH = 'http://internal.baci/api/orders';

export async function createAgenticCheckoutOrder(
  orderPayload: Record<string, unknown>
) {
  const request = new NextRequest(ORDERS_API_PATH, {
    method: 'POST',
    body: JSON.stringify(orderPayload),
    headers: {
      'content-type': 'application/json',
      [AGENTIC_INTERNAL_HEADER]: 'true',
    },
  });
  const response = await createOrder(request);
  const data = (await response.json()) as Record<string, unknown>;

  return {
    data,
    error: typeof data.error === 'string' ? data.error : undefined,
    ok: response.status === 200 || response.status === 201,
    orderId: getCreatedOrderId(data),
    status: response.status,
    statusText: response.statusText,
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

function getCreatedOrderId(data: Record<string, unknown>) {
  const order = data.order;
  if (order && typeof order === 'object' && 'id' in order) {
    const id = (order as { id?: unknown }).id;
    return typeof id === 'string' ? id : undefined;
  }

  return typeof data.id === 'string' ? data.id : undefined;
}
