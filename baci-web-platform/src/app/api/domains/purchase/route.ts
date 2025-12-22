import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  calculateDomainPrice,
  getDomainPricing,
} from '@/config/domain-pricing';
import { type ContactInfo, registerDomain } from '@/lib/go54';
import { verifyTransaction as verifyPaystackPayment } from '@/lib/paystack';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/domains/purchase
 * Purchase a domain through Go54
 */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      domain,
      years = 1,
      contactInfo,
      paymentReference,
    } = await request.json();

    // Validate domain - using required separator [.-] instead of optional [-.]?
    // to prevent ReDoS (exponential backtracking) vulnerability
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
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Verify payment before proceeding
    // Payment must be completed and match the expected amount
    // codeql[js/user-controlled-bypass-of-security-check]
    if (!paymentReference) {
      return NextResponse.json(
        { error: 'Payment reference is required' },
        { status: 400 }
      );
    }

    // First, get the transaction record (might be pending if webhook hasn't fired yet)
    const { data: transactionRecord, error: transactionFetchError } =
      await supabase
        .from('transactions')
        .select('id, amount, status, metadata, merchant_id, gateway')
        .eq('gateway_reference', paymentReference)
        .single();

    if (transactionFetchError || !transactionRecord) {
      return NextResponse.json(
        {
          error:
            'Transaction not found. Please ensure you completed the payment.',
        },
        { status: 402 }
      );
    }

    // If transaction is still pending, verify directly with payment gateway
    let payment = transactionRecord;
    if (transactionRecord.status === 'pending') {
      // Verify with Paystack (domain payments use Paystack)
      const verificationResult = await verifyPaystackPayment(paymentReference);

      if (
        !verificationResult.success ||
        verificationResult.data.status !== 'success'
      ) {
        return NextResponse.json(
          {
            error: 'Payment not completed. Please complete your payment first.',
          },
          { status: 402 }
        );
      }

      // Update transaction status to 'success' since payment is confirmed
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          status: 'success',
          updated_at: new Date().toISOString(),
        })
        .eq('id', transactionRecord.id);

      if (updateError) {
        console.error('Failed to update transaction status:', updateError);
      }

      // Update local reference with new status
      payment = { ...transactionRecord, status: 'success' };
    }

    // Verify payment status is successful
    if (!['success', 'completed'].includes(payment.status)) {
      return NextResponse.json(
        { error: 'Payment not verified. Please complete payment first.' },
        { status: 402 }
      );
    }

    // Verify payment belongs to this merchant
    if (payment.merchant_id !== merchant.id) {
      return NextResponse.json(
        { error: 'Payment does not belong to this merchant' },
        { status: 403 }
      );
    }

    // Verify payment amount matches domain price
    const expectedAmount = priceCalculation.sellPrice;
    if (Number(payment.amount) < expectedAmount) {
      return NextResponse.json(
        {
          error: 'Payment amount insufficient',
          expected: expectedAmount,
          received: payment.amount,
        },
        { status: 402 }
      );
    }

    // Check if payment was already used for a domain purchase
    const paymentMetadata = payment.metadata as Record<string, unknown> | null;
    if (paymentMetadata?.domain_purchased) {
      return NextResponse.json(
        { error: 'This payment has already been used for a domain purchase' },
        { status: 409 }
      );
    }

    // Check if domain already exists
    const { data: existingDomain } = await supabase
      .from('domains')
      .select('id')
      .eq('domain', domain)
      .single();

    if (existingDomain) {
      return NextResponse.json(
        { error: 'This domain is already registered' },
        { status: 409 }
      );
    }

    // Prepare contact information from merchant profile
    // Map merchant fields to domain contact requirements with fallback defaults
    const resolvedFirstname =
      contactInfo?.firstname ||
      merchant.first_name ||
      merchant.business_name?.split(' ')[0] ||
      'Store';
    const resolvedLastname =
      contactInfo?.lastname ||
      merchant.last_name ||
      merchant.business_name?.split(' ').slice(1).join(' ') ||
      'Owner';
    const resolvedFullname =
      contactInfo?.fullname ||
      `${merchant.first_name || ''} ${merchant.last_name || ''}`.trim() ||
      merchant.business_name ||
      'Store Owner';
    const resolvedEmail =
      contactInfo?.email || merchant.email || user.email || '';
    // Use business_address field from merchant, fallback to generic Lagos address
    const resolvedAddress1 =
      contactInfo?.address1 ||
      merchant.address ||
      merchant.business_address ||
      '1 Marina Road';
    const resolvedCity = contactInfo?.city || merchant.city || 'Lagos';
    const resolvedState = contactInfo?.state || merchant.state || 'Lagos';
    const resolvedZipcode =
      contactInfo?.zipcode ||
      merchant.postal_code ||
      merchant.zipcode ||
      '100001';
    const resolvedCountry = merchant.country || 'NG';
    // Support phone from merchant's support_phone or phone field
    const resolvedPhonenumber =
      contactInfo?.phonenumber ||
      merchant.phone ||
      merchant.phone_number ||
      merchant.support_phone ||
      '+2348000000000';

    // Only email is truly required - others have defaults
    if (!resolvedEmail) {
      return NextResponse.json(
        {
          error: 'Email address is required for domain registration.',
        },
        { status: 400 }
      );
    }
    const contacts: ContactInfo = {
      firstname: resolvedFirstname,
      lastname: resolvedLastname,
      fullname: resolvedFullname,
      companyname: merchant.business_name || '',
      email: resolvedEmail,
      address1: resolvedAddress1,
      address2: contactInfo?.address2 || '',
      city: resolvedCity,
      state: resolvedState,
      zipcode: resolvedZipcode,
      country: resolvedCountry,
      phonenumber: resolvedPhonenumber,
    };

    try {
      // Register domain via Go54
      const registrationResult = await registerDomain({
        domain,
        regperiod: years,
        contacts: {
          registrant: contacts,
          tech: contacts,
          billing: contacts,
          admin: contacts,
        },
        // Use default nameservers (can be updated later)
        nameservers: {
          ns1: 'ns1.whogohost.com',
          ns2: 'ns2.whogohost.com',
        },
        addons: {
          dnsmanagement: 1,
          emailforwarding: 0,
          idprotection: 1, // Enable WHOIS privacy
        },
      });

      // Calculate expiry date
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + years);

      // Store domain in database
      const { data: newDomain, error: insertError } = await supabase
        .from('domains')
        .insert({
          merchant_id: merchant.id,
          domain,
          tld,
          domain_type: 'purchased',
          status: 'active',
          verified_at: new Date().toISOString(),
          purchase_info: {
            provider: 'go54',
            order_id: registrationResult.orderId,
            cost_price: priceCalculation.costPrice,
            sell_price: priceCalculation.sellPrice,
            profit: priceCalculation.profit,
            registered_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
            auto_renew: true,
            nameservers: ['ns1.whogohost.com', 'ns2.whogohost.com'],
            years,
          },
          nameservers: ['ns1.whogohost.com', 'ns2.whogohost.com'],
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error storing domain:', insertError);
        return NextResponse.json(
          { error: 'Domain registered but failed to store in database' },
          { status: 500 }
        );
      }

      // Mark payment as used for this domain purchase (prevent reuse)
      await supabase
        .from('transactions')
        .update({
          metadata: {
            ...(paymentMetadata || {}),
            domain_purchased: domain,
            domain_id: newDomain.id,
            purchased_at: new Date().toISOString(),
          },
        })
        .eq('id', payment.id);

      return NextResponse.json({
        success: true,
        domain: newDomain,
        message: `Successfully registered ${domain} for ${years} year(s)`,
        nextSteps: [
          'Domain will be active within 24 hours',
          'You can configure DNS settings in the domain settings',
          'Point your domain to Baci by updating nameservers',
        ],
      });
    } catch (go54Error: unknown) {
      console.error('Go54 registration error:', go54Error);
      const errorMessage =
        go54Error instanceof Error ? go54Error.message : 'Unknown error';

      return NextResponse.json(
        {
          error: 'Failed to register domain with Go54',
          details: errorMessage,
          suggestion:
            'Please ensure Go54 API credentials are configured and account has sufficient balance',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error purchasing domain:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
