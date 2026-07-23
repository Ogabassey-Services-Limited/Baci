import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateApiRequest } from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import {
  expireStaleWalletFundingIntents,
  getOrderWalletFundingIntent,
} from '@/lib/order-wallet-funding-intents';
import { resolveOrderFundingMerchantAndCustomer } from '@/lib/order-wallet-funding-route-context';
import { orderWalletFundingIntentPollSchema } from '@/schemas/order-wallet-funding-intent';

type RouteContext = {
  params: Promise<{ id: string }>;
};

const routeParamsSchema = z.object({
  id: z.uuid('Intent id must be a valid UUID'),
});

function formatIntent(
  intent: NonNullable<Awaited<ReturnType<typeof getOrderWalletFundingIntent>>>
) {
  return {
    currency: intent.currency,
    debitedAmount: intent.debitedAmount,
    excessAmount: intent.excessAmount,
    expectedAmount: intent.expectedAmount,
    expiresAt: intent.expiresAt,
    fundedAmount: intent.fundedAmount,
    id: intent.id,
    orderPaid: intent.status === 'completed',
    orderId: intent.orderId,
    remainingAmount: Math.max(intent.expectedAmount - intent.fundedAmount, 0),
    status: intent.status,
    targetOrderAmount: intent.targetOrderAmount,
  };
}

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  let intentId: string | undefined;
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const parsed = orderWalletFundingIntentPollSchema.safeParse({
      merchantId: searchParams.get('merchantId'),
      merchantSlug: searchParams.get('merchantSlug'),
    });
    if (!parsed.success) {
      return NextResponse.json(
        { code: 'INVALID_QUERY', error: 'Invalid query' },
        { status: 400 }
      );
    }

    const params = await context.params;
    const parsedParams = routeParamsSchema.safeParse(params);
    if (!parsedParams.success) {
      return NextResponse.json(
        { code: 'INVALID_INTENT_ID', error: 'Invalid intent id' },
        { status: 400 }
      );
    }
    intentId = parsedParams.data.id;

    const resolved = await resolveOrderFundingMerchantAndCustomer({
      identifiers: parsed.data,
      supabase: auth.supabase,
      user: auth.user,
    });
    if ('response' in resolved) return resolved.response;

    await expireStaleWalletFundingIntents({
      customerId: resolved.customer.id,
      merchantId: resolved.merchant.id,
      supabase: auth.supabase,
    });
    const intent = await getOrderWalletFundingIntent({
      customerId: resolved.customer.id,
      id: intentId,
      merchantId: resolved.merchant.id,
      supabase: auth.supabase,
    });
    if (!intent) {
      return NextResponse.json({ error: 'Intent not found' }, { status: 404 });
    }

    return NextResponse.json({ intent: formatIntent(intent) });
  } catch (error) {
    logger.error({
      error,
      intentId,
      message: 'Failed to fetch wallet order funding intent',
      route: 'order-funding-intents/[id]',
    });
    return NextResponse.json(
      { error: 'Failed to fetch wallet order funding intent' },
      { status: 500 }
    );
  }
}
