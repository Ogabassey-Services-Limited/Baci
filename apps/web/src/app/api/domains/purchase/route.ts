import { cookies } from 'next/headers';
import { after, type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  calculateDomainPrice,
  getDomainPricing,
} from '@/config/domain-pricing';
import { hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { triggerDomainEdgeConfigSync } from '@/lib/edge-config-sync';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { type ContactInfo, registerDomain } from '@/lib/go54';
import { verifyTransaction as verifyPaystackPayment } from '@/lib/paystack';
import { createClient } from '@/lib/supabase/server';

const DOMAIN_REGEX = /^[a-z0-9]+([.-][a-z0-9]+)*\.[a-z]{2,}$/i;

const ContactInfoInputSchema = z.object({
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  fullname: z.string().optional(),
  companyname: z.string().optional(),
  email: z.string().email().optional(),
  address1: z.string().optional(),
  address2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipcode: z.string().optional(),
  country: z.string().optional(),
  phonenumber: z.string().optional(),
});

const PurchaseRequestSchema = z.object({
  domain: z
    .string()
    .trim()
    .min(1)
    .regex(DOMAIN_REGEX, 'Invalid domain format')
    .transform((value) => value.toLowerCase()),
  years: z.coerce.number().int().min(1).max(10).default(1),
  contactInfo: ContactInfoInputSchema.optional(),
  paymentReference: z.string().trim().min(1).optional(),
});

/**
 * POST /api/domains/purchase
 * Purchase a domain through Go54
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

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsedRequest = PurchaseRequestSchema.safeParse(await request.json());
    if (!parsedRequest.success) {
      return NextResponse.json(
        {
          error: 'Invalid request payload',
          details: parsedRequest.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { domain, years, paymentReference } = parsedRequest.data;
    const contactInfo = parsedRequest.data.contactInfo;

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

    // Get merchant context (supports both owners and staff)
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'settings', 'edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    // Fetch merchant profile fields needed for domain registration contact info
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select(
        'id, first_name, last_name, business_name, email, phone, phone_number, support_phone, address, business_address, city, state, postal_code, zipcode, country'
      )
      .eq('id', merchantId)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Verify payment before proceeding
    // Payment must be completed and match the expected amount
    //
    // Input validation: Ensure paymentReference is provided.
    // Note: This is NOT a security bypass - it's input validation.
    // The actual security is enforced below via:
    // 1. Transaction lookup by gateway_reference (lines 94-109)
    // 2. Payment gateway verification with Paystack (lines 113-127)
    // 3. Payment status verification (lines 147-152)
    // 4. Merchant ownership check: payment.merchant_id === merchant.id (lines 155-160)
    // 5. Amount verification against expected price (lines 162-173)
    // lgtm[js/user-controlled-bypass] codeql[js/user-controlled-bypass-of-security-check]
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
        .eq('id', transactionRecord.id)
        .eq('merchant_id', merchantId);

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
    if (payment.merchant_id !== merchantId) {
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

    const markPaymentDomainPurchased = async (domainId?: string) => {
      const updatedMetadata: Record<string, unknown> = {
        ...(paymentMetadata || {}),
        domain_purchased: domain,
        purchased_at: new Date().toISOString(),
      };

      if (domainId) {
        updatedMetadata.domain_id = domainId;
      }

      const { error: paymentMetadataError } = await supabase
        .from('transactions')
        .update({ metadata: updatedMetadata })
        .eq('id', payment.id)
        .eq('merchant_id', merchantId);

      if (paymentMetadataError) {
        console.error(
          'Failed to mark payment as domain purchased:',
          paymentMetadataError
        );
      }
    };

    // Check if domain already exists
    const { data: existingDomain, error: existingDomainError } = await supabase
      .from('domains')
      .select('id, merchant_id')
      .eq('domain', domain)
      .maybeSingle();

    if (existingDomainError) {
      console.error('Error checking existing domain:', existingDomainError);
      return NextResponse.json(
        { error: 'Failed to check existing domain ownership' },
        { status: 500 }
      );
    }

    if (existingDomain) {
      if (existingDomain.merchant_id === merchantId) {
        // Domain already registered to this merchant - likely handled by webhook
        await markPaymentDomainPurchased(existingDomain.id);
        after(() => triggerDomainEdgeConfigSync());
        return NextResponse.json({
          success: true,
          domain: existingDomain,
          message: `Successfully verified ${domain}`,
          nextSteps: ['Domain is active'],
        });
      }

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

      if (!registrationResult.success) {
        console.error(
          'Go54 registration API failed:',
          registrationResult.error
        );
        return NextResponse.json(
          {
            error: 'Failed to register domain with Go54',
            details: registrationResult.error || 'Unknown error',
          },
          { status: 502 }
        );
      }

      // Calculate expiry date
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + years);

      // Promote purchased domain to primary only when merchant has no active
      // primary custom/purchased domain yet.
      const { data: existingPrimaryDomain, error: primaryDomainError } =
        await supabase
          .from('domains')
          .select('id')
          .eq('merchant_id', merchantId)
          .in('domain_type', ['custom', 'purchased'])
          .eq('status', 'active')
          .eq('is_primary', true)
          .limit(1)
          .maybeSingle();

      if (primaryDomainError) {
        console.error(
          'Failed checking existing primary domain:',
          primaryDomainError
        );
      }

      const shouldSetPrimary = !primaryDomainError && !existingPrimaryDomain;
      const nowIso = new Date().toISOString();

      // Store domain in database
      const { data: newDomain, error: insertError } = await supabase
        .from('domains')
        .insert({
          merchant_id: merchantId,
          domain,
          tld,
          domain_type: 'purchased',
          status: 'active',
          is_primary: shouldSetPrimary,
          verified_at: nowIso,
          ssl_status: 'active',
          go54_order_id: registrationResult.orderId || null,
          purchase_price: priceCalculation.sellPrice,
          renewal_price: priceCalculation.sellPrice,
          registered_at: nowIso,
          expires_at: expiresAt.toISOString(),
          auto_renew: true,
          nameservers: ['ns1.whogohost.com', 'ns2.whogohost.com'],
        })
        .select('id, domain, status, is_primary')
        .single();

      if (insertError) {
        console.error('Error storing domain after Go54 registration:', {
          domain,
          merchantId,
          go54OrderId: registrationResult.orderId || null,
          registrationResult,
          insertError,
        });
        return NextResponse.json(
          { error: 'Domain registered but failed to store in database' },
          { status: 500 }
        );
      }

      // Mark payment as used for this domain purchase (prevent reuse)
      await markPaymentDomainPurchased(newDomain.id);

      after(() => triggerDomainEdgeConfigSync());

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
