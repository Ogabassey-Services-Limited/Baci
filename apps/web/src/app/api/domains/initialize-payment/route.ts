import { nanoid } from 'nanoid';
import { NextResponse } from 'next/server';
import {
  calculateDomainPrice,
  getDomainPricing,
} from '@/config/domain-pricing';
import { authenticateApiRequest } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/domains/initialize-payment
 * Initialize a payment for domain purchase
 * This creates a pending transaction that must be completed before domain registration
 */
export async function POST(request: Request) {
  try {
    const adminSupabase = createAdminClient();

    // Authenticate request (supports mobile Bearer token + web cookies)
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const { user, error: authError } = await authenticateApiRequest(
      request as any
    );

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { domain, years = 1 } = await request.json();

    // Validate domain format
    const domainRegex = /^[a-z0-9]+([.-][a-z0-9]+)*\.[a-z]{2,}$/i;
    if (!domainRegex.test(domain)) {
      return NextResponse.json(
        { error: 'Invalid domain format' },
        { status: 400 }
      );
    }

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
    // Get merchant
    const { data: merchant, error: merchantError } = await adminSupabase
      .from('merchants')
      .select('id, business_name, email, slug')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Generate unique payment reference for domain purchase
    const reference = `DOM-${nanoid(12).toUpperCase()}`;

    // Create pending transaction record
    const { error: transactionError } = await adminSupabase
      .from('transactions')
      .insert({
        merchant_id: merchant.id,
        transaction_type: 'payment', // DB check constraint requires 'payment'
        amount: priceCalculation.sellPrice,
        currency: 'NGN',
        status: 'pending',
        gateway: 'paystack', // Default to Paystack for domain purchases
        gateway_reference: reference,
        platform_fee: priceCalculation.profit, // Platform keeps the markup as fee
        merchant_amount: 0, // Merchant doesn't receive anything - this is a service purchase
        description: `Domain purchase: ${domain} for ${years} year(s)`,
        metadata: {
          domain,
          tld,
          years,
          transaction_type: 'domain_purchase', // Store specific type in metadata
          cost_price: priceCalculation.costPrice,
          sell_price: priceCalculation.sellPrice,
          category: priceCalculation.category,
        },
      })
      .select()
      .single();

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
    console.log('[DomainPayment] Initializing Paystack...');
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
        body: JSON.stringify({
          email: merchant.email || user.email,
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
      const errorData = await paystackResponse.json();
      console.error(
        '[DomainPayment] Paystack Init Failed:',
        JSON.stringify(errorData)
      );
      return NextResponse.json(
        { error: 'Failed to initialize payment gateway' },
        { status: 500 }
      );
    }

    const paystackData = await paystackResponse.json();

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
