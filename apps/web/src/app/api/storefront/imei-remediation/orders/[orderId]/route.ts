import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getRootDomain, isPetrockRemediationEnabled } from '@/env';
import { authenticateApiRequest } from '@/lib/api-auth';
import { resolveImeiCustomer } from '@/lib/imei-lookup-fulfillment';
import { readCustomerPetrockRemediationOrders } from '@/lib/imei-remediation/petrock-remediation-customer-orders';
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit';
import { resolveStorefrontMerchantFromRequest } from '@/lib/storefront-merchant';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function notFound() {
  return NextResponse.json(
    { code: 'ORDER_NOT_FOUND', error: 'Order not found', success: false },
    { status: 404 }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user || !auth.supabase) {
    return NextResponse.json(
      { code: 'AUTH_REQUIRED', error: 'Unauthorized', success: false },
      { status: 401 }
    );
  }
  if (!isPetrockRemediationEnabled()) return notFound();

  const rateLimit = await checkRateLimit(request);
  if (!rateLimit.allowed) {
    return createRateLimitResponse(
      rateLimit.limit,
      rateLimit.remaining,
      rateLimit.resetTime
    );
  }
  const { orderId } = await params;
  if (!UUID_PATTERN.test(orderId)) return notFound();

  const merchant = await resolveStorefrontMerchantFromRequest({
    lookupError: 'Failed to validate storefront host',
    notFoundError: 'Remediation is only available on storefront hosts',
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

  try {
    const orders = await readCustomerPetrockRemediationOrders({
      customerId: customer.id,
      merchantId,
      orderId,
      supabase: auth.supabase,
    });
    const order = orders[0];
    return order ? NextResponse.json({ order, success: true }) : notFound();
  } catch (error) {
    console.error('[Petrock Remediation] Customer order status failed', {
      error,
      orderId,
    });
    return NextResponse.json(
      {
        code: 'ORDER_READ_FAILED',
        error: 'Unable to load unlock order',
        success: false,
      },
      { status: 500 }
    );
  }
}
