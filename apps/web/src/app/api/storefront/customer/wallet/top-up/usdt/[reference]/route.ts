import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getRootDomain, isUsdtWalletEnabled } from '@/env';
import { authenticateApiRequest } from '@/lib/api-auth';
import { USDT_WALLET_TOP_UP_TRANSACTION_TYPE } from '@/lib/customer-wallet-account';
import { resolveImeiCustomer } from '@/lib/imei-lookup-fulfillment';
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit';
import { resolveStorefrontMerchantFromRequest } from '@/lib/storefront-merchant';
import { createAdminClient } from '@/lib/supabase/admin';

const REFERENCE_PATTERN = /^wusdt_[a-z0-9_]{6,44}$/i;

function notFound() {
  return NextResponse.json({ error: 'Funding not found' }, { status: 404 });
}

function addressFromGatewayResponse(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const address = (value as Record<string, unknown>).address;
  if (!address || typeof address !== 'object') return null;
  const record = address as Record<string, unknown>;
  return {
    address: typeof record.address === 'string' ? record.address : null,
    chain: typeof record.chain === 'string' ? record.chain : null,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user || !auth.supabase) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isUsdtWalletEnabled()) return notFound();
  const rateLimit = await checkRateLimit(request);
  if (!rateLimit.allowed) {
    return createRateLimitResponse(
      rateLimit.limit,
      rateLimit.remaining,
      rateLimit.resetTime
    );
  }

  const { reference } = await params;
  if (!REFERENCE_PATTERN.test(reference)) return notFound();
  const merchant = await resolveStorefrontMerchantFromRequest({
    lookupError: 'Failed to validate storefront host',
    notFoundError: 'USDT funding is only available on storefront hosts',
    request,
    rootDomain: getRootDomain() || 'usebaci.com',
  });
  if (!merchant.success) return notFound();
  const merchantId = String(merchant.merchant.id);
  const customer = await resolveImeiCustomer({
    merchantId,
    supabase: auth.supabase,
    user: auth.user,
  });
  if (!customer) return notFound();

  const { data, error } = await createAdminClient()
    .from('transactions')
    .select(
      'id, amount, currency, status, gateway_response, metadata, updated_at'
    )
    .eq('gateway_reference', reference)
    .eq('gateway', 'juicyway')
    .eq('merchant_id', merchantId)
    .eq('currency', 'USDT')
    .maybeSingle();
  if (error) {
    console.error('[USDT Wallet] Funding status read failed', {
      error,
      reference,
    });
    return NextResponse.json(
      { error: 'Unable to read funding status' },
      { status: 500 }
    );
  }
  const metadata =
    data?.metadata && typeof data.metadata === 'object'
      ? (data.metadata as Record<string, unknown>)
      : null;
  if (
    !data ||
    metadata?.customer_id !== customer.id ||
    metadata.transaction_type !== USDT_WALLET_TOP_UP_TRANSACTION_TYPE
  ) {
    return notFound();
  }

  const deposit = addressFromGatewayResponse(data.gateway_response);
  const status = String(data.status);
  const fundingStatus = ['completed', 'successful', 'success'].includes(status)
    ? 'completed'
    : status === 'failed'
      ? 'failed'
      : 'pending';
  return NextResponse.json({
    amount: Number(data.amount),
    chain: deposit?.chain ?? null,
    currency: 'USDT',
    depositAddress: deposit?.address ?? null,
    fundingStatus,
    reference,
    success: true,
    updatedAt: data.updated_at,
  });
}
