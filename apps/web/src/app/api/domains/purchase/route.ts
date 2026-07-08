import { cookies } from 'next/headers';
import { after, type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  calculateDomainPrice,
  getDomainPricing,
} from '@/config/domain-pricing';
import { hasPermission } from '@/lib/api-auth';
import { revalidateMerchantFeed } from '@/lib/cache-revalidation';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  claimDomainFulfillment,
  hasDomainRegistrarProof,
  isTerminalDomainRegistrationFailure,
  markRegistrarAttempted,
  releaseDomainFulfillmentClaim,
} from '@/lib/domains/fulfillment-claim';
import { triggerDomainEdgeConfigSync } from '@/lib/edge-config-sync';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { type ContactInfo, isGo54Configured, registerDomain } from '@/lib/go54';
import {
  merchantFeatureUpgradeResponse,
  merchantHasFeature,
} from '@/lib/merchant-feature-gates';
import { verifyTransaction as verifyPaystackPayment } from '@/lib/paystack';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const DOMAIN_REGEX = /^[a-z0-9]+([.-][a-z0-9]+)*\.[a-z]{2,}$/i;

const ContactInfoInputSchema = z.object({
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  fullname: z.string().optional(),
  companyname: z.string().optional(),
  email: z.email().optional(),
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
  years: z.coerce.number().int().min(1).max(10).prefault(1),
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
          details: z.flattenError(parsedRequest.error),
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
        'id, plan_tier, plan_expires_at, premium_features, first_name, last_name, business_name, email, phone, phone_number, support_phone, address, business_address, city, state, postal_code, zipcode, country'
      )
      .eq('id', merchantId)
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

      // Paystack returns "success"; our transactions table stores "completed".
      // Must use the service-role client: transactions has no merchant UPDATE
      // policy, so the user-scoped client silently updates zero rows and the
      // row would stay "pending" forever (inviting webhook replays). Persist
      // the verified gateway payload too — when this update wins the race the
      // webhook's completion update no-ops and would never store it.
      const { error: updateError } = await createAdminClient()
        .from('transactions')
        .update({
          status: 'completed',
          gateway_response: verificationResult.data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', transactionRecord.id)
        .eq('merchant_id', merchantId);

      if (updateError) {
        console.error('Failed to update transaction status:', updateError);
      }

      // Update local reference with new status
      payment = { ...transactionRecord, status: 'completed' };
    }

    // Verify payment status is successful
    if (payment.status !== 'completed') {
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

    // Fulfillment writes (transactions mark-purchased/claim, domains repair
    // inserts/updates) must use the service-role client: staff users pass the
    // route's permission checks but lack owner RLS on these tables, so the
    // cookie-scoped client would silently fail for them.
    const adminSupabase = createAdminClient();

    // Check if payment was already used for a domain purchase. This guard
    // runs BEFORE the current-pricing amount check: a fulfilled payment was
    // already price-validated when it was initialized and charged, so a later
    // price increase must not block verifying/repairing the registered domain.
    const paymentMetadata = payment.metadata as Record<string, unknown> | null;
    if (paymentMetadata?.domain_purchased) {
      const purchasedDomain = String(
        paymentMetadata.domain_purchased
      ).toLowerCase();
      if (purchasedDomain !== domain) {
        return NextResponse.json(
          { error: 'This payment has already been used for a domain purchase' },
          { status: 409 }
        );
      }

      // Already fulfilled for THIS domain — the registrar is NEVER
      // re-contacted. But if the post-registration domains-row write failed,
      // the retry lands here with a registered domain invisible to Baci:
      // verify the row, repairing it from the payment metadata if missing.
      // Admin client: domains_select_policy hides non-active rows from staff,
      // so a cookie-scoped read would miss a pending fallback row and
      // wrongly attempt a duplicate insert.
      const { data: fulfilledRow, error: fulfilledRowError } =
        await adminSupabase
          .from('domains')
          .select('id, domain, status, is_primary, merchant_id')
          .eq('domain', purchasedDomain)
          .maybeSingle();

      if (fulfilledRowError) {
        return NextResponse.json(
          { error: 'Failed to check existing domain ownership' },
          { status: 500 }
        );
      }

      if (fulfilledRow) {
        if (fulfilledRow.merchant_id !== merchantId) {
          return NextResponse.json(
            { error: 'This domain is already registered' },
            { status: 409 }
          );
        }
        if (fulfilledRow.status !== 'active') {
          // A prior attempt left a non-active row (e.g. the webhook's
          // fulfillment catch persists a pending fallback row): activate it —
          // the registrar order already exists.
          const activateExpiresAt = new Date(
            typeof paymentMetadata.purchased_at === 'string'
              ? paymentMetadata.purchased_at
              : new Date().toISOString()
          );
          activateExpiresAt.setFullYear(
            activateExpiresAt.getFullYear() +
              (Number(paymentMetadata.years) || years)
          );
          // Promote to primary if the merchant has no active primary yet —
          // an inactive fallback row was inserted is_primary=false, but once
          // active it may be the merchant's first domain.
          const { data: activatePrimary, error: activatePrimaryError } =
            await adminSupabase
              .from('domains')
              .select('id')
              .eq('merchant_id', merchantId)
              .in('domain_type', ['custom', 'purchased'])
              .eq('status', 'active')
              .eq('is_primary', true)
              .limit(1)
              .maybeSingle();
          const { error: activateError } = await adminSupabase
            .from('domains')
            .update({
              status: 'active',
              ssl_status: 'active',
              verified_at: new Date().toISOString(),
              expires_at: activateExpiresAt.toISOString(),
              auto_renew: true,
              is_primary: !activatePrimaryError && !activatePrimary,
              go54_order_id:
                typeof paymentMetadata.domain_registrar_order_id === 'string'
                  ? paymentMetadata.domain_registrar_order_id
                  : null,
            })
            .eq('id', fulfilledRow.id);

          if (activateError) {
            console.error(
              'Failed to activate repaired domains row:',
              activateError
            );
            return NextResponse.json(
              {
                error:
                  'Domain is registered but could not be activated. Please try again.',
              },
              { status: 500 }
            );
          }
          revalidateMerchantFeed(merchantId);
          after(() => triggerDomainEdgeConfigSync());
        }
        return NextResponse.json({
          success: true,
          domain: { ...fulfilledRow, status: 'active' },
          message: `Successfully verified ${purchasedDomain}`,
          nextSteps: ['Domain is active'],
        });
      }

      const repairYears = Number(paymentMetadata.years) || years;
      const registeredAtIso =
        typeof paymentMetadata.purchased_at === 'string'
          ? paymentMetadata.purchased_at
          : new Date().toISOString();
      const repairExpiresAt = new Date(registeredAtIso);
      repairExpiresAt.setFullYear(repairExpiresAt.getFullYear() + repairYears);

      // Preserve primary promotion, mirroring the normal insert path: a
      // merchant's first custom/purchased domain becomes primary. Admin
      // client so staff see the merchant's full domain set.
      const { data: repairExistingPrimary, error: repairPrimaryError } =
        await adminSupabase
          .from('domains')
          .select('id')
          .eq('merchant_id', merchantId)
          .in('domain_type', ['custom', 'purchased'])
          .eq('status', 'active')
          .eq('is_primary', true)
          .limit(1)
          .maybeSingle();

      const { data: repairedRow, error: repairError } = await adminSupabase
        .from('domains')
        .insert({
          merchant_id: merchantId,
          domain: purchasedDomain,
          tld,
          domain_type: 'purchased',
          status: 'active',
          is_primary: !repairPrimaryError && !repairExistingPrimary,
          verified_at: new Date().toISOString(),
          ssl_status: 'active',
          go54_order_id:
            typeof paymentMetadata.domain_registrar_order_id === 'string'
              ? paymentMetadata.domain_registrar_order_id
              : null,
          // Record what was actually PAID, not today's price — the repair can
          // run after a price change.
          purchase_price: Number(payment.amount) || priceCalculation.sellPrice,
          renewal_price: Number(payment.amount) || priceCalculation.sellPrice,
          registered_at: registeredAtIso,
          expires_at: repairExpiresAt.toISOString(),
          auto_renew: true,
          nameservers: ['ns1.whogohost.com', 'ns2.whogohost.com'],
        })
        .select('id, domain, status, is_primary')
        .single();

      if (repairError || !repairedRow) {
        console.error('Failed to repair missing domains row:', repairError);
        return NextResponse.json(
          {
            error:
              'Domain is registered but could not be restored. Please contact support.',
          },
          { status: 500 }
        );
      }

      revalidateMerchantFeed(merchantId);
      after(() => triggerDomainEdgeConfigSync());
      return NextResponse.json({
        success: true,
        domain: repairedRow,
        message: `Successfully restored ${purchasedDomain}`,
        nextSteps: ['Domain is active'],
      });
    }

    // Verify payment amount matches the CURRENT domain price (unfulfilled
    // payments only — fulfilled ones were validated at purchase time above).
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

    const markPaymentDomainPurchased = async (
      domainId?: string,
      registrarOrderId?: string
    ) => {
      const updatedMetadata: Record<string, unknown> = {
        ...(paymentMetadata || {}),
        domain_purchased: domain,
        purchased_at: new Date().toISOString(),
      };

      if (domainId) {
        updatedMetadata.domain_id = domainId;
      }
      if (registrarOrderId) {
        // Preserved for the domains-row repair path: identifies the registrar
        // order without ever re-contacting the registrar.
        updatedMetadata.domain_registrar_order_id = registrarOrderId;
      }

      const { error: paymentMetadataError } = await adminSupabase
        .from('transactions')
        .update({ metadata: updatedMetadata })
        .eq('id', payment.id)
        .eq('merchant_id', merchantId);

      if (paymentMetadataError) {
        console.error(
          'Failed to mark payment as domain purchased:',
          paymentMetadataError
        );
        return false;
      }
      return true;
    };

    // Check if domain already exists. Admin client: domains_select_policy
    // hides non-active rows from staff, so a cookie-scoped read could miss an
    // existing row and wrongly proceed to a duplicate registration.
    const { data: existingDomain, error: existingDomainError } =
      await adminSupabase
        .from('domains')
        .select(
          'id, merchant_id, status, domain_type, go54_order_id, is_primary'
        )
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
        if (!hasDomainRegistrarProof(existingDomain)) {
          console.warn(
            'Existing domain row lacks registrar proof before registration attempt:',
            {
              domain,
              existingDomainType: existingDomain.domain_type,
              existingStatus: existingDomain.status,
              paymentId: payment.id,
            }
          );
        } else if (existingDomain.status !== 'active') {
          const activateExpiresAt = new Date();
          activateExpiresAt.setFullYear(
            activateExpiresAt.getFullYear() + years
          );
          const { data: activatePrimary, error: activatePrimaryError } =
            await adminSupabase
              .from('domains')
              .select('id')
              .eq('merchant_id', merchantId)
              .in('domain_type', ['custom', 'purchased'])
              .eq('status', 'active')
              .eq('is_primary', true)
              .limit(1)
              .maybeSingle();
          const domainPurchaseAmount =
            Number(payment.amount) || priceCalculation.sellPrice;
          const { error: activateError } = await adminSupabase
            .from('domains')
            .update({
              status: 'active',
              ssl_status: 'active',
              verified_at: new Date().toISOString(),
              expires_at: activateExpiresAt.toISOString(),
              auto_renew: true,
              is_primary: !activatePrimaryError && !activatePrimary,
              purchase_price: domainPurchaseAmount,
              renewal_price: domainPurchaseAmount,
              nameservers: ['ns1.whogohost.com', 'ns2.whogohost.com'],
            })
            .eq('id', existingDomain.id);

          if (activateError) {
            console.error(
              'Failed to activate existing domain before marking payment:',
              activateError
            );
            return NextResponse.json(
              {
                error:
                  'Domain is registered but could not be activated. Please try again.',
              },
              { status: 500 }
            );
          }

          const marked = await markPaymentDomainPurchased(existingDomain.id);
          if (!marked) {
            return NextResponse.json(
              {
                error:
                  'Domain is active but payment usage could not be recorded. Please try again.',
              },
              { status: 500 }
            );
          }
          revalidateMerchantFeed(merchantId);
          after(() => triggerDomainEdgeConfigSync());
          return NextResponse.json({
            success: true,
            domain: { ...existingDomain, status: 'active' },
            message: `Successfully verified ${domain}`,
            nextSteps: ['Domain is active'],
          });
        } else {
          const marked = await markPaymentDomainPurchased(existingDomain.id);
          if (!marked) {
            return NextResponse.json(
              {
                error:
                  'Domain is active but payment usage could not be recorded. Please try again.',
              },
              { status: 500 }
            );
          }
          revalidateMerchantFeed(merchantId);
          after(() => triggerDomainEdgeConfigSync());
          return NextResponse.json({
            success: true,
            domain: { ...existingDomain, status: 'active' },
            message: `Successfully verified ${domain}`,
            nextSteps: ['Domain is active'],
          });
        }
      } else {
        return NextResponse.json(
          { error: 'This domain is already registered' },
          { status: 409 }
        );
      }
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

    // Atomically claim fulfillment for this payment. The Paystack webhook can
    // be fulfilling the same completed transaction concurrently — only the
    // claim winner may call the registrar, or one payment could be registered
    // (and charged at the registrar) twice.
    const claimInput = {
      transactionId: payment.id,
      metadata: paymentMetadata ?? {},
      claimant: 'purchase_route',
    };
    const claimOutcome = await claimDomainFulfillment(
      adminSupabase,
      claimInput
    );
    if (claimOutcome.status === 'error') {
      // The claim WRITE failed — fulfillment state is unknown; surface a
      // retryable failure instead of misreporting "in progress".
      return NextResponse.json(
        { error: 'Could not start domain registration. Please try again.' },
        { status: 500 }
      );
    }
    if (claimOutcome.status === 'contested') {
      return NextResponse.json(
        {
          error:
            'Domain registration for this payment is already in progress. Please refresh in a moment.',
        },
        { status: 409 }
      );
    }
    const claimRelease = { ...claimInput, claimedAt: claimOutcome.claimedAt };

    // Preflight registrar credentials BEFORE stamping the attempt: a
    // missing-config failure happens before any registrar request, so
    // releasing is definitively safe (unlike a mid-request failure).
    if (!isGo54Configured()) {
      console.error(
        'Domain registrar credentials not configured — cannot fulfill:',
        { transactionId: payment.id, domain }
      );
      await releaseDomainFulfillmentClaim(adminSupabase, claimRelease);
      return NextResponse.json(
        {
          error: 'Domain registrar is not configured. Please contact support.',
        },
        { status: 500 }
      );
    }

    // Stamp the registrar attempt BEFORE contacting the registrar: a crash
    // mid-call must leave a claim that can never be taken over (unknown
    // outcome — manual reconciliation, never a double order).
    const attemptStamped = await markRegistrarAttempted(
      adminSupabase,
      claimRelease
    );
    if (!attemptStamped) {
      // Registrar NOT contacted — releasing is safe; the user can retry.
      await releaseDomainFulfillmentClaim(adminSupabase, claimRelease);
      return NextResponse.json(
        { error: 'Could not start domain registration. Please try again.' },
        { status: 500 }
      );
    }

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
        // Registration failed: release the claim so the webhook (or a retry)
        // can attempt fulfillment for this paid transaction.
        const released = await releaseDomainFulfillmentClaim(
          adminSupabase,
          claimRelease
        );
        if (!released) {
          // The attempt marker still blocks every automatic retry — a
          // silently failed release strands this paid purchase.
          console.error(
            'Domain fulfillment claim release failed after registrar failure — claim retained, manual reconciliation required:',
            { transactionId: payment.id, domain }
          );
        }
        return NextResponse.json(
          {
            error: 'Failed to register domain with Go54',
            details: registrationResult.error || 'Unknown error',
          },
          { status: 502 }
        );
      }

      // Mark the purchase fulfilled IMMEDIATELY: the registrar order exists
      // now, so even if the domains-row write below fails, no later caller
      // (stale-claim takeover included) may re-register and double-charge
      // this payment. This stamp is also what lets the repair path recognize
      // the registered domain — retry once and escalate loudly if it cannot
      // be written (the attempt marker still prevents duplicate orders).
      const purchasedMarked =
        (await markPaymentDomainPurchased(
          undefined,
          registrationResult.orderId
        )) ||
        (await markPaymentDomainPurchased(
          undefined,
          registrationResult.orderId
        ));
      if (!purchasedMarked) {
        console.error(
          'CRITICAL: fulfilled marker write failed after registrar success — manual reconciliation required:',
          {
            transactionId: payment.id,
            domain,
            registrarOrderId: registrationResult.orderId,
          }
        );
      }

      // Calculate expiry date
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + years);

      // Promote purchased domain to primary only when merchant has no active
      // primary custom/purchased domain yet. Admin client so staff see the
      // merchant's full domain set.
      const { data: existingPrimaryDomain, error: primaryDomainError } =
        await adminSupabase
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

      const domainPayload = {
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
      };

      let newDomain: {
        domain: string;
        id: string;
        is_primary: boolean;
        status: string;
      } | null = null;

      if (existingDomain?.merchant_id === merchantId) {
        const { error: updateExistingDomainError } = await adminSupabase
          .from('domains')
          .update(domainPayload)
          .eq('id', existingDomain.id);

        if (updateExistingDomainError) {
          console.error('Error updating domain after Go54 registration:', {
            domain,
            merchantId,
            go54OrderId: registrationResult.orderId || null,
            registrationResult,
            updateExistingDomainError,
          });
          return NextResponse.json(
            { error: 'Domain registered but failed to update database record' },
            { status: 500 }
          );
        }

        newDomain = {
          domain,
          id: existingDomain.id,
          is_primary: shouldSetPrimary,
          status: 'active',
        };
      } else {
        const { data: insertedDomain, error: insertError } = await adminSupabase
          .from('domains')
          .insert(domainPayload)
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

        newDomain = insertedDomain;
      }

      if (!newDomain) {
        return NextResponse.json(
          { error: 'Domain registered but persistence result was empty' },
          { status: 500 }
        );
      }

      // Mark payment as used for this domain purchase (prevent reuse)
      const marked = await markPaymentDomainPurchased(
        newDomain.id,
        registrationResult.orderId
      );
      if (!marked) {
        console.error(
          'Failed to mark payment as domain purchased after successful registration:',
          {
            transactionId: payment.id,
            domain,
            domainId: newDomain.id,
            registrarOrderId: registrationResult.orderId,
          }
        );
        return NextResponse.json(
          {
            error:
              'Domain is active but payment usage could not be recorded. Please try again.',
          },
          { status: 500 }
        );
      }

      revalidateMerchantFeed(merchantId);
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

      if (isTerminalDomainRegistrationFailure(go54Error)) {
        const released = await releaseDomainFulfillmentClaim(
          adminSupabase,
          claimRelease
        );
        if (!released) {
          console.error(
            'Terminal Go54 registration error could not release domain fulfillment claim:',
            { transactionId: payment.id, domain, error: errorMessage }
          );
          return NextResponse.json(
            {
              error:
                'Failed to register domain with Go54 and release retry claim',
              details: errorMessage,
            },
            { status: 500 }
          );
        }

        console.error(
          'Terminal Go54 registration error — claim released for manual retry:',
          { transactionId: payment.id, domain, error: errorMessage }
        );
        return NextResponse.json(
          {
            error: 'Failed to register domain with Go54',
            details: errorMessage,
            suggestion:
              'Please review the domain details or registrar account and try again',
          },
          { status: 502 }
        );
      }

      // Registration threw mid-flight — the registrar outcome is UNKNOWN
      // (e.g. a timeout after the order was accepted), so the claim is
      // deliberately NOT released: an automatic retry could double-order the
      // domain. Reconciled manually from this log.
      console.error(
        'Domain fulfillment ambiguous — claim retained, manual reconciliation required:',
        { transactionId: payment.id, domain }
      );

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
