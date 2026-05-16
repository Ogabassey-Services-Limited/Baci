import { type NextRequest, NextResponse } from 'next/server';
import { verifyAgenticRequestAccess } from '@/lib/agentic/agent-request-controls';
import { verifyAgenticApiKey } from '@/lib/agentic/auth';
import { resolveAgenticMerchantContext } from '@/lib/agentic/merchant-context';
import { readAgenticQueryRequest } from '@/lib/agentic/mutation-request';
import { createAgenticScopedSupabaseClient } from '@/lib/agentic/scoped-supabase';
import { logger } from '@/lib/logger';
import { sanitizeForLog } from '@/lib/sanitize-core';
import { buildStoreUrl } from '@/lib/store-url';
import { createAdminClient } from '@/lib/supabase/admin';
import { agenticOrderRouteParamsSchema } from '@/schemas/agentic-order-route-params';

const AGENTIC_ORDER_SELECT =
  'id, order_number, payment_status, shipping_status, tracking_number, created_at, updated_at';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  if (!verifyAgenticApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = await props.params;
  const parsedParams = agenticOrderRouteParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json(
      {
        error: 'Invalid route params',
        details: parsedParams.error.flatten(),
      },
      { status: 400 }
    );
  }

  const signedRead = await readAgenticQueryRequest({
    request,
  });
  if (!signedRead.ok) {
    return signedRead.response;
  }

  const bootstrap = createAdminClient();
  const merchant = await resolveAgenticMerchantContext(bootstrap);
  if (!merchant) {
    return NextResponse.json(
      { error: 'Agentic merchant not found' },
      { status: 500 }
    );
  }
  const agentAccess = verifyAgenticRequestAccess({
    controls: {
      allowlist: merchant.agent_user_agent_allowlist ?? [],
      denylist: merchant.agent_user_agent_denylist ?? [],
    },
    headers: request.headers,
  });
  if (!agentAccess.ok) {
    return NextResponse.json({ error: agentAccess.error }, { status: 403 });
  }

  const supabase = createAgenticScopedSupabaseClient({
    merchantId: merchant.id,
    merchantSlug: merchant.slug,
  });

  const { data: order, error } = await supabase
    .from('orders')
    .select(AGENTIC_ORDER_SELECT)
    .eq('id', parsedParams.data.id)
    .eq('merchant_id', merchant.id)
    .eq('source', 'agentic_ai')
    .maybeSingle();

  if (error) {
    logger.error({
      message: 'Failed to fetch agentic order',
      error: sanitizeForLog(error),
      merchantId: merchant.id,
      orderId: parsedParams.data.id,
    });
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    );
  }

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const storeUrl = buildStoreUrl(merchant);

  return NextResponse.json({
    id: order.id,
    order_number: order.order_number,
    payment_status: order.payment_status,
    shipping_status: order.shipping_status,
    tracking_number: order.tracking_number,
    created_at: order.created_at,
    updated_at: order.updated_at,
    links: {
      track_order: `${storeUrl}/track-order`,
      support: `${storeUrl}/contact`,
    },
  });
}
