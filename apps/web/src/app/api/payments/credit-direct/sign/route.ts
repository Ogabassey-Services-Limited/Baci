import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import {
  CREDIT_DIRECT_CONFIG,
  generateSessionId,
  getPrivateKey,
  getPublicKey,
  isAmountEligible,
  isLiveMode,
  signTransaction,
} from '@/lib/credit-direct';
import { getCurrentSlugForAlias } from '@/lib/slug-alias-cache';
import { createClient } from '@/lib/supabase/server';
import { creditDirectSignSchema } from '@/schemas/credit-direct';

/**
 * POST /api/payments/credit-direct/sign
 *
 * Signs a Credit Direct BNPL transaction server-side.
 * The private key is never exposed to the client.
 *
 * CSRF exemption: This is an unauthenticated storefront endpoint for BNPL checkout.
 * Guest users do not have CSRF tokens.
 *
 * Request body:
 * - customerEmail: string
 * - totalAmount: number (in NGN)
 * - merchantSlug: string
 * - orderId: string (required, for linking)
 *
 * Response:
 * - signature: string (HMAC-SHA256 hex)
 * - publicKey: string
 * - sessionId: string
 * - isLive: boolean
 */
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Validate request with Zod
    const parsed = creditDirectSignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      customerEmail,
      totalAmount,
      merchantSlug: rawMerchantSlug,
      orderId,
    } = parsed.data;

    // Resolve a retired slug to the current one: a checkout tab open on the store
    // BEFORE a rename submits the old slug in the body (which the proxy can't
    // rewrite), and the settings RPC filters `WHERE m.slug = p_merchant_slug`, so
    // without this it would 404. getCurrentSlugForAlias returns null for a live
    // slug, so a normal checkout is unaffected.
    const currentSlug = await getCurrentSlugForAlias(
      rawMerchantSlug.trim().toLowerCase()
    );
    const merchantSlug = currentSlug ?? rawMerchantSlug;

    // This is an unauthenticated endpoint for storefront checkout
    // It uses RLS-protected RPCs to fetch public merchant settings
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Fetch merchant + Credit Direct settings (public-safe RPC)
    const { data: settingsRows, error: settingsError } = await supabase.rpc(
      'get_credit_direct_settings',
      { p_merchant_slug: merchantSlug }
    );

    const settings =
      Array.isArray(settingsRows) && settingsRows.length > 0
        ? settingsRows[0]
        : null;

    if (settingsError || !settings) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const merchantId = settings.merchant_id;
    if (typeof merchantId !== 'string' || !merchantId) {
      return NextResponse.json(
        { error: 'Invalid merchant configuration' },
        { status: 500 }
      );
    }

    const creditDirectEnabled = settings?.credit_direct_enabled ?? false;

    if (!creditDirectEnabled) {
      console.error('Credit Direct Sign Blocked: Feature disabled', {
        merchant: merchantSlug,
        merchantId,
      });
      return NextResponse.json(
        { error: 'Credit Direct BNPL is not enabled for this merchant' },
        { status: 403 }
      );
    }

    const minAmount =
      settings?.credit_direct_min_amount ?? CREDIT_DIRECT_CONFIG.minAmount;
    const maxAmount =
      settings?.credit_direct_max_amount ?? CREDIT_DIRECT_CONFIG.maxAmount;

    // Validate order context and ensure email matches order
    const { data: snapshotRows, error: snapshotError } = await supabase.rpc(
      'get_order_payment_snapshot',
      {
        p_order_id: orderId,
        p_email: customerEmail,
      }
    );

    const orderSnapshot =
      Array.isArray(snapshotRows) && snapshotRows.length > 0
        ? snapshotRows[0]
        : null;

    if (snapshotError || !orderSnapshot) {
      return NextResponse.json(
        { error: 'Order not found or email mismatch' },
        { status: 404 }
      );
    }

    if (orderSnapshot.merchant_id !== merchantId) {
      return NextResponse.json(
        { error: 'Merchant mismatch for this order' },
        { status: 403 }
      );
    }

    // A cancelled order must never be payable — including via a Credit Direct
    // BNPL loan origination (mirrors the guard in payments/initialize).
    if (orderSnapshot.shipping_status === 'cancelled') {
      return NextResponse.json(
        {
          error: 'This order has been cancelled and can no longer be paid',
          code: 'ORDER_NOT_PAYABLE',
        },
        { status: 409 }
      );
    }

    const snapshotTotal = Number(orderSnapshot.total);
    if (Number.isNaN(snapshotTotal)) {
      return NextResponse.json(
        { error: 'Invalid order total' },
        { status: 400 }
      );
    }
    if (snapshotTotal <= 0) {
      return NextResponse.json(
        { error: 'Invalid order total' },
        { status: 400 }
      );
    }
    if (totalAmount > snapshotTotal) {
      return NextResponse.json(
        { error: 'Amount exceeds order total' },
        { status: 400 }
      );
    }

    // Validate amount is within eligible range
    if (!isAmountEligible(totalAmount, minAmount, maxAmount)) {
      return NextResponse.json(
        {
          error: `Amount must be between ₦${minAmount.toLocaleString()} and ₦${maxAmount.toLocaleString()} for BNPL`,
          minAmount,
          maxAmount,
        },
        { status: 400 }
      );
    }

    // Get the matching key pair from environment. The private key is only
    // available server-side, so falling back to a DB public key here can create
    // a mismatched pair that Credit Direct rejects after the user leaves Baci.
    let privateKey: string;
    try {
      privateKey = getPrivateKey();
    } catch {
      return NextResponse.json(
        { error: 'Credit Direct is not configured. Please contact support.' },
        { status: 500 }
      );
    }

    let publicKey: string;
    try {
      publicKey = getPublicKey();
    } catch {
      return NextResponse.json(
        { error: 'Credit Direct public key not configured' },
        { status: 500 }
      );
    }

    // Generate session ID
    const sessionId = generateSessionId(15);

    // Sign the transaction
    const signature = signTransaction(
      sessionId,
      customerEmail,
      totalAmount,
      privateKey
    );

    // Store the session mapping for webhook reconciliation
    const { error: sessionError } = await supabase.rpc(
      'set_credit_direct_session',
      {
        p_order_id: orderId,
        p_email: customerEmail,
        p_merchant_id: merchantId,
        p_session_id: sessionId,
        p_signed_amount: totalAmount,
      }
    );

    if (sessionError) {
      console.error('Failed to link Credit Direct session:', sessionError);
      return NextResponse.json(
        { error: 'Failed to initialize Credit Direct checkout' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signature,
      publicKey,
      sessionId,
      isLive: isLiveMode(),
    });
  } catch (error) {
    console.error('Credit Direct sign error:', error);
    return NextResponse.json(
      { error: 'Failed to sign transaction' },
      { status: 500 }
    );
  }
}
