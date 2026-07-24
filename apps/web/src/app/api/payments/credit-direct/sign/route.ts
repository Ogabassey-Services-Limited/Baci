import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import {
  generateSessionId,
  getPrivateKey,
  getPublicKey,
  isLiveMode,
  signTransaction,
} from '@/lib/credit-direct';
import { resolveCreditDirectRpcError } from '@/lib/payments/credit-direct-checkout-token';
import { getCurrentSlugForAlias } from '@/lib/slug-alias-cache';
import { createClient } from '@/lib/supabase/server';
import { creditDirectSignSchema } from '@/schemas/credit-direct';

/**
 * POST /api/payments/credit-direct/sign
 *
 * Signs a Credit Direct BNPL transaction server-side and starts the session
 * behind a single-use capability token (S2-P). The private key is never
 * exposed to the client, and the amount that gets signed / recorded is derived
 * by the database from the locked order row — a client-supplied `totalAmount`
 * is validated for shape but never trusted for money.
 *
 * CSRF exemption: This is an unauthenticated storefront endpoint for BNPL
 * checkout. Guest users do not have CSRF tokens.
 *
 * Request body:
 * - customerEmail: string
 * - totalAmount: number (shape-validated only; the DB derives the real amount)
 * - merchantSlug: string
 * - orderId: string (uuid)
 *
 * Response:
 * - signature: string (HMAC-SHA256 hex)
 * - publicKey: string
 * - sessionId: string
 * - isLive: boolean
 * - amount: number (server-derived amount that was signed — clients MUST use
 *   this for the popup so the transaction matches the signature)
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
      merchantSlug: rawMerchantSlug,
      orderId,
    } = parsed.data;

    // Resolve a retired slug to the current one: a checkout tab open on the
    // store BEFORE a rename submits the old slug in the body (which the proxy
    // can't rewrite), and the settings RPC filters `WHERE m.slug =
    // p_merchant_slug`, so without this it would 404. getCurrentSlugForAlias
    // returns null for a live slug, so a normal checkout is unaffected.
    const currentSlug = await getCurrentSlugForAlias(
      rawMerchantSlug.trim().toLowerCase()
    );
    const merchantSlug = currentSlug ?? rawMerchantSlug;

    // This is an unauthenticated endpoint for storefront checkout. It uses
    // RLS-protected / bounded SECURITY DEFINER RPCs on the caller's client
    // (never the service-role client) to read settings and mutate the order.
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

    if (!(settings.credit_direct_enabled ?? false)) {
      console.error('Credit Direct Sign Blocked: Feature disabled', {
        merchant: merchantSlug,
        merchantId,
      });
      return NextResponse.json(
        { error: 'Credit Direct BNPL is not enabled for this merchant' },
        { status: 403 }
      );
    }

    // Generate the session id up front so the capability token binds to it and
    // the signature covers the same session.
    const sessionId = generateSessionId(15);

    // Issue a single-use capability token. The DB locks the order, derives the
    // payable amount from the locked row (never trusting the client), validates
    // payability + enablement + eligible range, and binds the token to
    // {order, merchant, server-derived amount, expiry, session}.
    const { data: issuedRows, error: issueError } = await supabase.rpc(
      'issue_credit_direct_checkout_token',
      {
        p_order_id: orderId,
        p_email: customerEmail,
        p_merchant_id: merchantId,
        p_session_id: sessionId,
      }
    );

    if (issueError) {
      const mapped = resolveCreditDirectRpcError(issueError.message);
      return NextResponse.json(mapped.body, { status: mapped.status });
    }

    const issued =
      Array.isArray(issuedRows) && issuedRows.length > 0 ? issuedRows[0] : null;
    if (!issued || typeof issued.checkout_token !== 'string') {
      return NextResponse.json(
        { error: 'Failed to initialize Credit Direct checkout' },
        { status: 500 }
      );
    }

    const checkoutToken = issued.checkout_token;
    const signedAmount = Number(issued.signed_amount);
    if (!Number.isFinite(signedAmount) || signedAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid order total' },
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

    // Sign the SERVER-DERIVED amount — never a client-supplied value.
    const signature = signTransaction(
      sessionId,
      customerEmail,
      signedAmount,
      privateKey
    );

    // Consume the capability token: single-use (atomic), re-derives and matches
    // the amount against the locked order, and starts the BNPL session.
    const { error: sessionError } = await supabase.rpc(
      'set_credit_direct_session',
      {
        p_checkout_token: checkoutToken,
        p_order_id: orderId,
        p_merchant_id: merchantId,
        p_session_id: sessionId,
        p_signed_amount: signedAmount,
      }
    );

    if (sessionError) {
      // Log the error message only — never the raw token.
      console.error(
        'Failed to link Credit Direct session:',
        sessionError.message
      );
      const mapped = resolveCreditDirectRpcError(sessionError.message);
      return NextResponse.json(mapped.body, { status: mapped.status });
    }

    return NextResponse.json({
      signature,
      publicKey,
      sessionId,
      isLive: isLiveMode(),
      amount: signedAmount,
    });
  } catch (error) {
    console.error('Credit Direct sign error:', error);
    return NextResponse.json(
      { error: 'Failed to sign transaction' },
      { status: 500 }
    );
  }
}
