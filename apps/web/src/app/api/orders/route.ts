import { cookies } from 'next/headers';
import { after, type NextRequest, NextResponse } from 'next/server';
import { getQuizPhaseEnv, getQuizProductionApprovedEnv } from '@/env';
import {
  computeAgenticOrderTax,
  isTaxComputeUuidError,
} from '@/lib/agentic/checkout-order-tax';
import { authenticateApiRequest, hasPermission } from '@/lib/api-auth';
import {
  computeCanonicalOrderSubtotal,
  isCanonicalOrderSubtotalUuidError,
} from '@/lib/checkout/canonical-order-subtotal';
import { computeExpectedTotalDiscount } from '@/lib/checkout/expected-total-discount';
import {
  generateOrderConfirmationEmail,
  generateOrderConfirmationText,
} from '@/lib/email-templates';
import { notifyNewOrder, notifyPaymentReceived } from '@/lib/expo-push';
import { FEATURES, isPlanTier, planHasFeature } from '@/lib/feature-flags';
import { formatVariantAttributesLabel } from '@/lib/format-variant-attributes-label';
import { detectPrivacyRegion } from '@/lib/geo-privacy';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { logger } from '@/lib/logger';
import { ORDER_WITH_ITEMS_QUERY } from '@/lib/order-queries';
import {
  enforcePrizeProductionGuard,
  QuizProductionNotApprovedError,
} from '@/lib/quiz-compliance-gate';
import { getClientIdentifier } from '@/lib/rate-limit';
import { sanitizeLikePattern, sanitizeSearchQuery } from '@/lib/sanitize-core';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/zeptomail';
import { orderCreateSchema } from '@/schemas/orders';

function isPayOnDelivery(paymentMethod: string): boolean {
  return paymentMethod === 'pod' || paymentMethod === 'pay_on_delivery';
}

/** Server-authoritative assurance rate — never trust the client value. */
const SERVER_ASSURANCE_RATE = 0.05;
const LEGACY_NEGOTIATION_SLUGS = new Set(['ogabassey', 'demo-premium']);

function hasPriceNegotiationEntitlement(
  planTier: string | null | undefined,
  merchantSlug: string | null | undefined
): boolean {
  if (isPlanTier(planTier)) {
    return planHasFeature(planTier, FEATURES.PRICE_NEGOTIATION);
  }

  // If plan_tier is present but malformed, fail closed.
  if (planTier != null) {
    return false;
  }

  // Maintain legacy storefront entitlement fallback until all
  // merchants are backfilled with an explicit `plan_tier`.
  return (
    typeof merchantSlug === 'string' &&
    LEGACY_NEGOTIATION_SLUGS.has(merchantSlug.toLowerCase())
  );
}

type EmailOrderItem = {
  name?: string;
  productName?: string;
  quantity?: number;
  price?: number;
};

type QuizVoucherItemCandidate = {
  voucherAwardId?: unknown;
  voucherToken?: unknown;
  voucher_award_id?: unknown;
  voucher_token?: unknown;
};

function hasNonEmptyVoucherIdentifier(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasQuizVoucherItem(items: QuizVoucherItemCandidate[]): boolean {
  return items.some(
    (item) =>
      hasNonEmptyVoucherIdentifier(item.voucher_award_id) ||
      hasNonEmptyVoucherIdentifier(item.voucherAwardId) ||
      hasNonEmptyVoucherIdentifier(item.voucher_token) ||
      hasNonEmptyVoucherIdentifier(item.voucherToken)
  );
}

// GET /api/orders - Fetch orders for authenticated merchant
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      logger.error({ message: 'API: Auth error or no user', error: authError });
      return NextResponse.json(
        { error: 'Unauthorized: You must be logged in to fetch orders.' },
        { status: 401 }
      );
    }

    // Get merchant record (supports both owners and staff members)
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      logger.error({
        message: 'API: Merchant not found for user',
        userId: user.id,
      });
      return NextResponse.json(
        { error: 'Merchant not found for the authenticated user.' },
        { status: 404 }
      );
    }
    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'orders', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const merchantId = merchantContext.merchantId;

    // Get search params for filtering
    const { searchParams } = new URL(request.url);
    const paymentStatus = searchParams.get('payment_status');
    const shippingStatus = searchParams.get('shipping_status');
    const searchRaw = searchParams.get('search');

    // Sanitize search input
    const search = searchRaw ? sanitizeSearchQuery(searchRaw) : null;

    // Build query
    let query = supabase
      .from('orders')
      .select(ORDER_WITH_ITEMS_QUERY)
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (paymentStatus && paymentStatus !== 'all') {
      query = query.eq('payment_status', paymentStatus);
    }

    if (shippingStatus && shippingStatus !== 'all') {
      query = query.eq('shipping_status', shippingStatus);
    }

    // Search by customer name or order number (with sanitized input)
    if (search?.trim()) {
      const sanitizedPattern = sanitizeLikePattern(search);
      query = query.or(
        `customer_name.ilike.%${sanitizedPattern}%,order_number.ilike.%${sanitizedPattern}%`
      );
    }

    const { data: orders, error: ordersError } = await query;

    if (ordersError) {
      logger.error({ message: 'Error fetching orders', error: ordersError });
      return NextResponse.json(
        { error: 'Failed to fetch orders from the database.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ orders: orders || [] });
  } catch (error) {
    logger.error({ message: 'Unexpected error in GET /api/orders', error });
    return NextResponse.json(
      { error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}

// POST /api/orders - Create new order from storefront
// CSRF exemption: This endpoint is called by unauthenticated storefront guests during checkout.
// Guest users do not have CSRF tokens. Abuse is mitigated by rate limiting in proxy.ts,
// Zod validates input shape, while the SECURITY DEFINER RPC enforces merchant + item authorization server-side.
export async function POST(request: NextRequest) {
  try {
    // Optional auth: supports web cookies and mobile Bearer tokens, but still
    // allows guest checkout when authentication is absent.
    const auth = await authenticateApiRequest(request);
    const supabase = auth.supabase ?? createClient(await cookies());
    const user = auth.user;
    const json = await request.json();

    // Capture IP and User Agent for enhanced ad tracking (improves Event Match Quality)
    // Use centralized IP resolution logic to prevent spoofing
    const clientIp = getClientIdentifier(request);
    const clientUserAgent = request.headers.get('user-agent') || undefined;

    // Detect privacy region for CCPA/GDPR compliance (LDU flag)
    const geoPrivacy = await detectPrivacyRegion(clientIp);

    const parseResult = orderCreateSchema.safeParse(json);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const body = parseResult.data;

    const {
      merchant_id,
      customer_email,
      customer_name,
      customer_phone,
      items,
      shipping_fee, // Default already handled by Zod
      payment_method,
      payment_status,
      shipping_status,
      shipping_address,
      source,
      notes,
      // Ad tracking data for offline conversions
      ad_tracking,
      // Wallet redemption
      use_wallet_credit,
      wallet_amount,
      // User ID
      user_id,
    } = body;

    if (user && user_id && user_id !== user.id) {
      return NextResponse.json({ error: 'User mismatch' }, { status: 403 });
    }

    // Phase 1a intentionally runs hasQuizVoucherItem/enforcePrizeProductionGuard
    // before merchant verification so quiz voucher requests fail closed first.
    if (hasQuizVoucherItem(items)) {
      try {
        // Phase 1a has no prize-bearing order path. The later production
        // voucher path must load the quiz event/compliance evidence before
        // calling create_storefront_order_with_quiz_voucher.
        const quizProductionApproved =
          getQuizPhaseEnv() === 'production' && getQuizProductionApprovedEnv();
        enforcePrizeProductionGuard(
          { nlrc_permit_ref: null },
          quizProductionApproved
        );
      } catch (error) {
        if (error instanceof QuizProductionNotApprovedError) {
          return NextResponse.json(
            {
              error: 'Quiz vouchers are not approved for production use',
              code: error.code,
            },
            { status: error.status }
          );
        }

        throw error;
      }
    }

    // SECURITY: Only use user_id from authenticated session.
    // Do NOT trust user_id from body if user is unauthenticated (guest).
    const resolvedUserId = user?.id || null;

    // Fetch merchant to verify it exists (include business_name, slug for email)
    const { data: merchant, error: merchantFetchError } = await supabase
      .from('merchants')
      .select(
        'id, rider_phone_number, business_name, business_address, slug, support_email, email_sender_name, email, tax_identification_number, cac_rc_number, plan_tier'
      )
      .eq('id', merchant_id)
      .single();

    if (merchantFetchError || !merchant) {
      logger.error({
        message: 'Failed to fetch merchant for order creation',
        error: merchantFetchError,
      });
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const orderItemsPayload = items.map((item) => {
      const hasAssurance = item.has_assurance || false;
      const itemPrice = item.negotiatedPrice ?? item.price;
      // SECURITY: Recompute assurance_fee server-side — never trust client values
      const assuranceFee = hasAssurance ? itemPrice * SERVER_ASSURANCE_RATE : 0;

      return {
        product_id: item.product_id || item.productId || item.id,
        condition: item.condition,
        image_url: item.imageUrl ?? item.image_url ?? null,
        variant_id: item.variantId || item.variant_id,
        variant_attributes:
          item.variantAttributes || item.variant_attributes || {},
        quantity: item.quantity,
        has_assurance: hasAssurance,
        assurance_fee: assuranceFee,
      };
    });

    if (orderItemsPayload.some((item) => !item.product_id)) {
      return NextResponse.json(
        { error: 'Invalid order items' },
        { status: 400 }
      );
    }

    const shippingFeeValue = Number.parseFloat(shipping_fee.toString());
    const discountAmountValue = Number.parseFloat(
      (body.discount_amount || 0).toString()
    );
    const taxAmountValue = Number.parseFloat((body.tax_amount || 0).toString());
    // B3.5 (Δ-39): gift_wrapping_fee + tax_basis are now first-class
    // RPC params. Zod defaults gift_wrapping_fee to 0 and tax_basis to
    // 'exclusive', so legacy callers continue to work; VAT-aware
    // storefront callers pass both explicitly.
    const giftWrappingFeeValue = Number.parseFloat(
      (body.gift_wrapping_fee || 0).toString()
    );

    if (
      Number.isNaN(shippingFeeValue) ||
      Number.isNaN(discountAmountValue) ||
      Number.isNaN(taxAmountValue) ||
      Number.isNaN(giftWrappingFeeValue)
    ) {
      return NextResponse.json(
        { error: 'Invalid pricing values' },
        { status: 400 }
      );
    }

    if (discountAmountValue !== 0) {
      return NextResponse.json(
        {
          code: 'discount_amount_not_supported',
          error: 'Failed to create order',
        },
        { status: 400 }
      );
    }

    // Codex P1 (PR #1622 round 6): the legacy storefront checkout
    // (`apps/web/src/app/checkout/page.tsx`) doesn't send
    // `tax_amount` — Zod defaults to 0 — and that 0 tripped the
    // RPC's `tax_amount_mismatch` guard on every VAT-registered
    // merchant. Same root cause as the agentic dispatch.
    //
    // Recompute the canonical per-line tax server-side here so
    // every caller (legacy checkout, ogabassey checkout,
    // mobile-admin order-create, agentic) lands on a payload that
    // the RPC will accept. The `expected_total` parity guard
    // (Δ-39, Codex round 2) still catches client display drift —
    // it just gets to fire on a correctly-tax'd order rather than
    // being preceded by a confusing `tax_amount_mismatch` 400.
    //
    // The helper uses the caller's standard scoped client. The
    // single RLS-bypassing path (variant override lookup) goes
    // through the `get_order_variant_overrides` SECURITY DEFINER
    // RPC, granted to anon/authenticated/service_role — the trust
    // boundary lives in the database, not the Next.js layer
    // (CodeRabbit High on PR #1622 round 7).
    let serverComputedTaxAmount: number;
    try {
      serverComputedTaxAmount = await computeAgenticOrderTax({
        items: items.map((item) => ({
          product_id: item.product_id || item.productId || item.id,
          quantity: item.quantity,
          variant_id: item.variantId || item.variant_id,
        })),
        merchantId: merchant_id,
        supabase,
      });
    } catch (taxError) {
      // Codex P2 (PR #1622 round 7): malformed item ids (Zod only
      // validates as `string`) cascade into Postgres's UUID parser
      // as code 22P02. Pre-route-side-recompute, the RPC's own
      // 22P02 path got mapped via `clientErrorCodes` to a 400. We
      // must preserve that semantic so bad client payloads don't
      // look like server outages.
      if (isTaxComputeUuidError(taxError)) {
        logger.warn({
          error: taxError,
          merchantId: merchant_id,
          message: 'Storefront order received malformed item identifier',
        });
        // Match the RPC error mapping below (`{ error: 'Failed to
        // create order', details: <stable code> }`) AND share the
        // `invalid_items` identifier with the agentic dispatch's
        // 22P02 path — review findings on PR #1622 round 7.
        return NextResponse.json(
          {
            error: 'Failed to create order',
            details: 'invalid_items',
          },
          { status: 400 }
        );
      }
      logger.error({
        error: taxError,
        merchantId: merchant_id,
        message: 'Storefront order VAT recompute failed',
      });
      return NextResponse.json(
        { code: 'TAX_COMPUTE_FAILED', error: 'Unable to compute order tax' },
        { status: 500 }
      );
    }

    const merchantCanAutoNegotiate = hasPriceNegotiationEntitlement(
      merchant.plan_tier,
      merchant.slug
    );

    let serverDerivedDiscountAmount = 0;
    if (merchantCanAutoNegotiate && typeof body.expected_total === 'number') {
      let canonicalSubtotal: number | null;
      try {
        canonicalSubtotal = await computeCanonicalOrderSubtotal({
          items: orderItemsPayload,
          merchantId: merchant_id,
          supabase,
        });
      } catch (canonicalSubtotalError) {
        if (isCanonicalOrderSubtotalUuidError(canonicalSubtotalError)) {
          logger.warn({
            error: canonicalSubtotalError,
            merchantId: merchant_id,
            message:
              'Storefront order received malformed identifier during subtotal parity lookup',
          });
          return NextResponse.json(
            {
              error: 'Failed to create order',
              details: 'invalid_items',
            },
            { status: 400 }
          );
        }

        logger.error({
          error: canonicalSubtotalError,
          merchantId: merchant_id,
          message: 'Storefront order canonical subtotal recompute failed',
        });
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }

      if (canonicalSubtotal !== null) {
        const expectedTotalInput = {
          canonicalSubtotal,
          canonicalTaxAmount: serverComputedTaxAmount,
          shippingFee: shippingFeeValue,
          giftWrappingFee: giftWrappingFeeValue,
          expectedTotal: body.expected_total,
        };

        if (merchantCanAutoNegotiate) {
          serverDerivedDiscountAmount =
            computeExpectedTotalDiscount(expectedTotalInput);
        }
      }
    }

    const adTrackingPayload = ad_tracking
      ? {
          ...ad_tracking,
          userIp: clientIp || ad_tracking.userIp,
          userAgent: clientUserAgent || ad_tracking.userAgent,
          limitedDataUse:
            geoPrivacy.shouldApplyLDU || ad_tracking.limitedDataUse,
          geoCountry: geoPrivacy.country,
          geoRegion: geoPrivacy.region,
        }
      : clientIp || clientUserAgent || geoPrivacy.shouldApplyLDU
        ? {
            userIp: clientIp,
            userAgent: clientUserAgent,
            limitedDataUse: geoPrivacy.shouldApplyLDU,
            geoCountry: geoPrivacy.country,
            geoRegion: geoPrivacy.region,
          }
        : null;

    const resolvedShippingProvider = body.shipping_provider ?? null;
    const resolvedTrackingNumber = body.tracking_number ?? null;

    const payOnDelivery = isPayOnDelivery(payment_method);

    let effectivePaymentStatus = payment_status;
    if (payOnDelivery) {
      effectivePaymentStatus = 'pending';

      if (merchant?.rider_phone_number) {
        logger.info({
          message: 'Rider Notification Triggered (POD)',
          riderPhone: merchant.rider_phone_number,
          customerName: customer_name,
          customerAddress: shipping_address?.address,
        });
      } else {
        logger.warn({
          message: 'Rider Notification Skipped (No Phone Number)',
          merchantId: merchant_id,
        });
      }
    }

    const { data: orderRows, error: orderError } = await supabase.rpc(
      'create_storefront_order',
      {
        p_merchant_id: merchant_id,
        p_customer_email: customer_email,
        p_customer_name: customer_name,
        p_customer_phone: customer_phone || null,
        p_items: orderItemsPayload,
        p_shipping_fee: shippingFeeValue,
        p_discount_amount: serverDerivedDiscountAmount,
        p_tax_amount: serverComputedTaxAmount,
        p_payment_method: payment_method,
        p_payment_status: effectivePaymentStatus,
        p_shipping_status: shipping_status,
        p_shipping_address: shipping_address || null,
        p_source: source,
        p_notes: notes || null,
        p_ad_tracking: adTrackingPayload,
        p_selected_quote_id: body.selected_quote_id || null,
        p_shipping_provider: resolvedShippingProvider,
        p_tracking_number: resolvedTrackingNumber || null,
        p_user_id: resolvedUserId,
        // Server-computed tax — replaces the client-supplied value
        // so legacy callers without `tax_amount` succeed and
        // storefront callers can't fake a wrong-but-matching value
        // (Codex P1 round 6).
        // B3.5 (Δ-42, Δ-47): tax_basis + gift_wrapping_fee. The RPC
        // enforces VAT itself for VAT-registered merchants and also
        // runs a client/server total parity check (Codex P1) against
        // p_expected_total BEFORE any side effects, so a mismatch
        // rolls back atomically — no orphan order, no stock leak.
        //
        // Codex P1 round 6 (PR #1622): `tax_basis` is SERVER-controlled
        // policy, NOT caller input. The RPC itself overrides
        // `v_tax_basis := 'exclusive'` after enum validation
        // (`create_storefront_order` is GRANT'd to anon via PostgREST,
        // so the trust boundary has to live IN the function — see
        // the `Codex P1 round 6 ii` comment in
        // `20260512200000_storefront_order_vat_enforcement.sql`).
        // This API-level hardcode is defense-in-depth — any caller
        // routing through /api/orders also gets the right value
        // without relying on PostgREST RLS / RPC behavior.
        p_tax_basis: 'exclusive',
        p_gift_wrapping_fee: giftWrappingFeeValue,
        p_expected_total:
          typeof body.expected_total === 'number' ? body.expected_total : null,
      }
    );

    const order = Array.isArray(orderRows) ? orderRows[0] : orderRows;

    if (orderError || !order) {
      logger.error({ message: 'Error creating order', error: orderError });
      const code =
        typeof orderError?.code === 'string' ? orderError.code : null;
      const message =
        typeof orderError?.message === 'string'
          ? orderError.message
          : code || 'Failed to create order';
      const clientErrorCodes = [
        'invalid_items',
        'invalid_quantity',
        'invalid_variant',
        'insufficient_stock',
        'insufficient_variant_stock',
        'merchant_not_found',
        'customer_email_required',
        'customer_name_required',
        'items_required',
        'user_id_mismatch',
        'invalid_payment_status',
        'discount_amount_not_supported',
        // B3 (plan §5 B3): RPC raises when shipping_provider is set
        // without a quote id. Map to 4xx so the client gets the right
        // re-quote signal instead of a generic 500.
        'shipping_quote_required',
        // B3.5 (Δ-42, Δ-47): RPC raises when the client-supplied
        // VAT/total/gift-wrap inputs violate merchant VAT config.
        // All client-side input errors → 400 so the storefront can
        // re-quote / re-render the order summary cleanly instead of
        // bouncing the user with a generic 500.
        'invalid_tax_basis',
        'tax_amount_mismatch',
        'tax_amount_must_be_zero_for_non_vat_merchant',
        'gift_wrapping_fee_negative',
        // B3.5 (Codex P1 — PR #1622): RPC RAISES this when the
        // client-supplied `p_expected_total` differs from the
        // server-computed total by > ₦1. The RAISE happens BEFORE
        // any side effects so the transaction rolls back cleanly
        // — safe for client to fix and retry.
        'order_total_mismatch',
        '22P02', // PostgreSQL: Invalid text representation (e.g. invalid UUID format)
      ];
      // create_storefront_order should return { message, code } for client errors.
      const isClientError =
        (code ? clientErrorCodes.includes(code) : false) ||
        clientErrorCodes.includes(message);
      return NextResponse.json(
        { error: 'Failed to create order', details: message },
        { status: isClientError ? 400 : 500 }
      );
    }

    const orderTotal = Number(order.total ?? 0);
    const orderSubtotal = Number(order.subtotal ?? 0);
    const orderShippingFee = Number(order.shipping_fee ?? shippingFeeValue);
    const customer_id = order.customer_id || null;
    const orderNum = order.order_number || order.id.slice(0, 8).toUpperCase();

    // === WALLET REDEMPTION (2025 Best Practice: Auto-apply at checkout) ===
    // Process wallet credit redemption atomically after order creation
    let walletRedemptionResult: {
      success: boolean;
      amountRedeemed: number;
      newBalance: number;
      transactionId: string | null;
    } | null = null;

    if (use_wallet_credit && wallet_amount > 0 && customer_id) {
      try {
        // Call atomic wallet redemption function (handles idempotency via order_id)
        const { data: redemptionData, error: redemptionError } =
          await supabase.rpc('redeem_wallet_for_order', {
            p_customer_id: customer_id,
            p_merchant_id: merchant_id,
            p_order_id: order.id,
            p_amount: Math.min(wallet_amount, orderTotal), // Can't redeem more than order total
            p_order_reference: order.order_number || order.id,
          });

        if (redemptionError) {
          // Log but don't fail order - wallet redemption is optional
          logger.error({
            message: 'Wallet redemption failed',
            error: redemptionError,
            orderId: order.id,
            customerId: customer_id,
            requestedAmount: wallet_amount,
          });
        } else if (redemptionData?.[0]) {
          const result = redemptionData[0];
          if (result.success) {
            walletRedemptionResult = {
              success: true,
              amountRedeemed: Number(result.redeemed_amount),
              newBalance: Number(result.new_balance),
              transactionId: result.transaction_id,
            };

            logger.info({
              message: 'Wallet redemption successful',
              orderId: order.id,
              customerId: customer_id,
              amountRedeemed: result.redeemed_amount,
              newBalance: result.new_balance,
            });
          } else {
            logger.warn({
              message: 'Wallet redemption returned unsuccessful',
              orderId: order.id,
              customerId: customer_id,
              result,
            });
          }
        }
      } catch (walletError) {
        logger.error({
          message: 'Wallet redemption exception',
          error: walletError,
          orderId: order.id,
        });
      }
    }

    // Calculate amount due to payment gateway (total - wallet credit used)
    const walletAmountUsed = walletRedemptionResult?.amountRedeemed || 0;
    const amountDueToGateway = orderTotal - walletAmountUsed;
    let walletFinalized = false;

    // If wallet fully covers the order, mark as paid immediately (2025 best practice)
    if (walletAmountUsed > 0 && amountDueToGateway <= 0) {
      const { error: walletFinalizeError } = await supabase.rpc(
        'finalize_wallet_order_payment',
        {
          p_order_id: order.id,
          p_amount: walletAmountUsed,
        }
      );

      if (walletFinalizeError) {
        logger.error({
          message: 'Failed to finalize wallet payment',
          error: walletFinalizeError,
          orderId: order.id,
        });
      } else {
        walletFinalized = true;
        logger.info({
          message: 'Order fully paid with wallet credit',
          orderId: order.id,
          walletAmountUsed,
        });
      }
    }

    // NOTE: Order confirmation email is NOT sent here at order creation.
    // It is sent ONLY after payment is confirmed via webhook handlers:
    // - /api/payments/webhook/route.ts (for Paystack/Korapay)
    // - /api/payments/juicyway/webhook/route.ts (for Juicyway)
    // This prevents sending confirmation emails for abandoned/unpaid orders.
    //
    // Exceptions (send immediately, but fire-and-forget via after()):
    // - POD (Pay on Delivery) or Invoice: no payment gateway redirect
    // - Wallet-paid orders: payment already confirmed via wallet redemption
    //
    // after() runs after the response is sent — email/push never block the response.
    const isWalletFullyPaid = walletFinalized;
    if (payOnDelivery || payment_method === 'invoice' || isWalletFullyPaid) {
      if (merchant.business_name && merchant.slug) {
        const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
        const merchantUrl = `https://${merchant.slug}.${rootDomain}`;

        const emailItems = items.map((item: EmailOrderItem) => ({
          name: (() => {
            const baseName = item.name || item.productName || 'Product';
            const variantLabel = formatVariantAttributesLabel(
              (
                item as EmailOrderItem & {
                  variantAttributes?: Record<string, string>;
                  variant_attributes?: Record<string, string>;
                }
              ).variantAttributes ||
                (
                  item as EmailOrderItem & {
                    variantAttributes?: Record<string, string>;
                    variant_attributes?: Record<string, string>;
                  }
                ).variant_attributes
            );
            return variantLabel ? `${baseName} (${variantLabel})` : baseName;
          })(),
          quantity: item.quantity || 1,
          price: item.price || 0,
        }));

        const emailData = {
          orderNumber: orderNum,
          customerName: customer_name,
          items: emailItems,
          subtotal: orderSubtotal,
          shippingFee: orderShippingFee,
          total: orderTotal,
          shippingAddress: {
            address: shipping_address?.address || '',
            city: shipping_address?.city || '',
            state: shipping_address?.state || '',
            phone: customer_phone || '',
          },
          merchantName: merchant.business_name,
          merchantUrl,
          merchantTin: merchant.tax_identification_number ?? undefined,
          merchantRcNumber: merchant.cac_rc_number ?? undefined,
        };

        const htmlContent = generateOrderConfirmationEmail(emailData);
        const textContent = generateOrderConfirmationText(emailData);

        const replyToEmail =
          merchant.support_email ||
          merchant.email ||
          `support@${merchant.slug}.${rootDomain}`;
        const senderName = merchant.email_sender_name
          ? `${merchant.email_sender_name} Orders`
          : merchant.business_name
            ? `${merchant.business_name} Orders`
            : undefined;

        // Fire-and-forget: send email after response is delivered so slow/failing
        // ZeptoMail calls never block or time out the order creation response.
        after(async () => {
          try {
            const emailResult = await sendEmail({
              to: customer_email,
              toName: customer_name,
              subject: `Order Confirmation - #${emailData.orderNumber}`,
              htmlContent,
              textContent,
              replyTo: replyToEmail,
              emailType: 'orders',
              fromName: senderName,
              auditContext: {
                merchantId: merchant_id,
                orderId: order.id,
                customerId: customer_id,
                metadata: {
                  trigger: 'order_create_immediate_confirmation',
                  paymentMethod: payment_method,
                },
              },
            });

            if (!emailResult.success) {
              logger.error({
                message: 'Failed to send order confirmation email',
                orderId: order.id,
                paymentMethod: payment_method,
                emailError: emailResult.error,
                emailErrorCode: emailResult.errorCode,
                emailErrorDetails: emailResult.errorDetails,
              });
            } else {
              logger.info({
                message: 'Order confirmation email sent',
                orderId: order.id,
                paymentMethod: payment_method,
                messageId: emailResult.messageId,
              });
            }
          } catch (emailError) {
            logger.error({
              message: 'Error sending order confirmation email',
              error: emailError,
            });
          }
        });
      }

      // Notify merchant of new order — fire-and-forget via after() for the same reason.
      after(async () => {
        try {
          const pushResult = await notifyNewOrder(
            merchant_id,
            order.id,
            orderNum,
            customer_name,
            orderTotal
          );
          if (pushResult.failed > 0 || pushResult.errors.length > 0) {
            logger.warn({
              message: 'New order push notification was not fully delivered',
              orderId: order.id,
              merchantId: merchant_id,
              sent: pushResult.sent,
              failed: pushResult.failed,
              errors: pushResult.errors,
            });
          }
        } catch (err) {
          logger.error({ message: 'Push notification failed', error: err });
        }

        if (isWalletFullyPaid) {
          try {
            const paymentPushResult = await notifyPaymentReceived(
              merchant_id,
              orderTotal,
              order.currency || 'NGN',
              orderNum,
              order.id
            );
            if (
              paymentPushResult.failed > 0 ||
              paymentPushResult.errors.length > 0
            ) {
              logger.warn({
                message: 'Payment push notification was not fully delivered',
                orderId: order.id,
                merchantId: merchant_id,
                sent: paymentPushResult.sent,
                failed: paymentPushResult.failed,
                errors: paymentPushResult.errors,
              });
            }
          } catch (err) {
            logger.error({
              message: 'Payment push notification failed',
              error: err,
            });
          }
        }
      });
    }

    const responseOrder = isWalletFullyPaid
      ? { ...order, payment_status: 'paid', payment_method: 'wallet' }
      : order;

    // Return order with wallet info for checkout UI
    return NextResponse.json(
      {
        order: responseOrder,
        // Wallet redemption details for UI display
        wallet: walletRedemptionResult
          ? {
              amountUsed: walletRedemptionResult.amountRedeemed,
              newBalance: walletRedemptionResult.newBalance,
              transactionId: walletRedemptionResult.transactionId,
            }
          : null,
        // Amount still due to payment gateway (for payment initialization)
        amountDueToGateway,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error({ message: 'Unexpected error in POST /api/orders', error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
