import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import {
  expireStaleWalletFundingIntents,
  getOrderWalletFundingIntent,
} from '@/lib/order-wallet-funding-intents';
import {
  ORDER_FUNDING_MERCHANT_SELECT,
  resolveOrderFundingMerchantAndCustomer,
} from '@/lib/order-wallet-funding-route-context';
import { orderWalletFundingIntentPollSchema } from '@/schemas/order-wallet-funding-intent';

interface OrderFundingMerchant {
  business_name: string | null;
  id: string;
  paystack_subaccount_code: string | null;
  slug: string | null;
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

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
        { error: 'Invalid query', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const resolved =
      await resolveOrderFundingMerchantAndCustomer<OrderFundingMerchant>({
        identifiers: parsed.data,
        merchantSelect: ORDER_FUNDING_MERCHANT_SELECT,
        supabase: auth.supabase,
        user: auth.user,
      });
    if ('response' in resolved) return resolved.response;

    const params = await context.params;
    intentId = params.id;
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
