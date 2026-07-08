import { customAlphabet } from 'nanoid';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  calculateDomainPrice,
  getDomainPricing,
} from '@/config/domain-pricing';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  merchantFeatureUpgradeResponse,
  merchantHasFeature,
} from '@/lib/merchant-feature-gates';
import { createAdminClient } from '@/lib/supabase/admin';

const domainRegex = /^[a-z0-9]+([.-][a-z0-9]+)*\.[a-z]{2,}$/i;

const initDomainPaymentSchema = z.object({
  domain: z
    .string()
    .min(1)
    .refine((value) => domainRegex.test(value), {
      error: 'Invalid domain format',
    }),
  years: z.coerce.number().int().min(1).max(10).optional().prefault(1),
});

const nanoidUppercase = customAlphabet(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  12
);

/**
 * POST /api/domains/initialize-payment
 * Initialize a payment for domain purchase
 * This creates a pending transaction that must be completed before domain registration
 */
export async function POST(request: NextRequest) {
  try {
    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) {
      return (
        response ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    // Authenticate request (supports mobile Bearer token + web cookies)
    const auth = await authenticateApiRequest(request);

    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const access = await getUserAccess(auth.supabase);
    if (!access) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    if (!hasPermission(access, 'settings', 'edit')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const parsed = initDomainPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const { domain: rawDomain, years } = parsed.data;
    const domain = rawDomain.toLowerCase();
    const supabase = auth.supabase;

    // Extract TLD and get pricing
    let tld = `.${domain.split('.').slice(-1)[0]}`;
    if (
      domain.endsWith('.com.ng') ||
      domain.endsWith('.org.ng') ||
      domain.endsWith('.net.ng') ||
      domain.endsWith('.edu.ng') ||
      domain.endsWith('.name.ng')
    ) {
      tld = `.${domain.split('.').slice(-2).join('.')}`;
    }

    const pricing = getDomainPricing(tld);
    if (!pricing) {
      return NextResponse.json({ error: 'Unsupported TLD' }, { status: 400 });
    }

    const priceCalculation = calculateDomainPrice(tld, years);
    if (!priceCalculation) {
      return NextResponse.json(
        { error: 'Unable to calculate price' },
        { status: 400 }
      );
    }

    // Get merchant
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select(
        'id, business_name, email, slug, plan_tier, plan_expires_at, premium_features'
      )
      .eq('id', access.merchantId)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    if (!merchantHasFeature(merchant, 'custom_domain')) {
      return merchantFeatureUpgradeResponse('custom_domain');
    }

    // Validate email is available before calling Paystack
    const paymentEmail = merchant.email || auth.user.email;
    if (!paymentEmail) {
      return NextResponse.json(
        {
          error:
            'No email available for payment. Please update your merchant email.',
        },
        { status: 400 }
      );
    }

    // Generate unique payment reference for domain purchase (case-preserving entropy)
    const reference = `DOM-${nanoidUppercase()}`;

    // Create the pending transaction via the service-role-only RPC. The
    // function is NOT callable from user-scoped clients: the payments webhook
    // trusts this row's amount and metadata for fulfillment, so pricing must
    // only ever be written by this route (which computed it server-side above,
    // after the auth + settings/edit + custom_domain plan checks). The RPC
    // still re-verifies check_staff_permission(p_user_id, p_merchant_id,
    // 'settings', 'edit') as defense in depth.
    const adminSupabase = createAdminClient();
    const { error: transactionError } = await adminSupabase.rpc(
      'create_domain_purchase_transaction',
      {
        p_domain: domain,
        p_tld: tld,
        p_years: years,
        p_amount: priceCalculation.sellPrice,
        p_cost_price: priceCalculation.costPrice,
        p_sell_price: priceCalculation.sellPrice,
        p_category: priceCalculation.category,
        p_reference: reference,
        p_gateway: 'paystack',
        p_currency: 'NGN',
        p_merchant_id: access.merchantId,
        p_user_id: auth.user.id,
      }
    );

    if (transactionError) {
      console.error('Error creating transaction:', transactionError);
      return NextResponse.json(
        { error: 'Failed to create payment' },
        { status: 500 }
      );
    }

    // Build redirect URL for after payment
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const callbackUrl = `${protocol}://${rootDomain}/dashboard/domains/callback?reference=${reference}&domain=${encodeURIComponent(domain)}&years=${years}`;

    // Initialize Paystack payment
    if (!process.env.PAYSTACK_SECRET_KEY) {
      console.error('[DomainPayment] PAYSTACK_SECRET_KEY is missing');
      return NextResponse.json(
        { error: 'Payment configuration error' },
        { status: 500 }
      );
    }

    const paystackResponse = await fetch(
      'https://api.paystack.co/transaction/initialize',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          email: paymentEmail,
          amount: Math.round(priceCalculation.sellPrice * 100), // Paystack uses kobo
          reference,
          callback_url: callbackUrl,
          channels: ['card', 'bank', 'ussd', 'bank_transfer'],
          metadata: {
            merchant_id: merchant.id,
            domain,
            tld,
            years,
            transaction_type: 'domain_purchase',
          },
        }),
      }
    );

    if (!paystackResponse.ok) {
      let errorData: unknown;
      try {
        errorData = await paystackResponse.json();
      } catch {
        errorData = await paystackResponse
          .text()
          .catch(() => 'unreadable body');
      }
      console.error('[DomainPayment] Paystack Init Failed:', errorData);
      return NextResponse.json(
        { error: 'Failed to initialize payment gateway' },
        { status: 500 }
      );
    }

    const paystackData = await paystackResponse.json();
    if (!paystackData?.data?.authorization_url) {
      console.error(
        '[DomainPayment] Unexpected Paystack response:',
        paystackData
      );
      return NextResponse.json(
        { error: 'Unexpected payment gateway response' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      reference,
      authorization_url: paystackData.data.authorization_url,
      amount: priceCalculation.sellPrice,
      domain,
      years,
    });
  } catch (error) {
    console.error('Error initializing domain payment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
