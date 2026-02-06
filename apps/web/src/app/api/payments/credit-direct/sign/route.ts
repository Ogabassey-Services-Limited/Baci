import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';
import {
  CREDIT_DIRECT_CONFIG,
  generateSessionId,
  getPrivateKey,
  getPublicKey,
  isAmountEligible,
  isLiveMode,
  signTransaction,
} from '@/lib/credit-direct';

/**
 * POST /api/payments/credit-direct/sign
 *
 * Signs a Credit Direct BNPL transaction server-side.
 * The private key is never exposed to the client.
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
    const body = await request.json();
    const { customerEmail, totalAmount, merchantSlug, orderId } = body;

    // Validate required fields
    if (!customerEmail || !totalAmount || !merchantSlug || !orderId) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: customerEmail, totalAmount, merchantSlug, orderId',
        },
        { status: 400 }
      );
    }

    // Validate email format with length limit to prevent ReDoS
    const isValidEmail =
      customerEmail.length <= 254 &&
      customerEmail.includes('@') &&
      customerEmail.indexOf('@') > 0 &&
      customerEmail.lastIndexOf('.') > customerEmail.indexOf('@') + 1 &&
      !/\s/.test(customerEmail);
    if (!isValidEmail) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate amount is a positive number
    if (typeof totalAmount !== 'number' || totalAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount: must be a positive number' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient(
      getSupabaseUrl(),
      getSupabaseAnonKey(),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );

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

    const merchantId = settings.merchant_id as string;

    console.log('Credit Direct Sign Debug:', {
      requestSlug: merchantSlug,
      foundMerchantId: merchantId,
      settingsFound: !!settings,
      creditDirectEnabled: settings?.credit_direct_enabled,
      settingsError,
    });

    if (settingsError) {
      console.error('Error fetching merchant feature settings:', settingsError);
      // Continue with defaults if there's an error
    }

    const creditDirectEnabled = settings?.credit_direct_enabled ?? false;

    if (!creditDirectEnabled) {
      console.error('Credit Direct Sign Blocked: Feature disabled', {
        merchant: merchantSlug,
        settings,
      });
      return NextResponse.json(
        { error: 'Credit Direct BNPL is not enabled for this merchant' },
        { status: 403 }
      );
    }

    const merchantPublicKey = settings?.credit_direct_public_key;
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

    const snapshotTotal = Number(orderSnapshot.total);
    if (!Number.isNaN(snapshotTotal) && totalAmount > snapshotTotal) {
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

    // Generate session ID
    const sessionId = generateSessionId(15);

    // Get private key (from environment or merchant settings)
    let privateKey: string;
    try {
      privateKey = getPrivateKey();
    } catch {
      return NextResponse.json(
        { error: 'Credit Direct is not configured. Please contact support.' },
        { status: 500 }
      );
    }

    // Sign the transaction
    const signature = signTransaction(
      sessionId,
      customerEmail,
      totalAmount,
      privateKey
    );

    // Get public key (prefer merchant-specific, fallback to environment)
    let publicKey: string;
    if (merchantPublicKey) {
      publicKey = merchantPublicKey;
    } else {
      try {
        publicKey = getPublicKey();
      } catch {
        return NextResponse.json(
          { error: 'Credit Direct public key not configured' },
          { status: 500 }
        );
      }
    }

    // Store the session mapping for webhook reconciliation
    const { error: sessionError } = await supabase.rpc(
      'set_credit_direct_session',
      {
        p_order_id: orderId,
        p_email: customerEmail,
        p_merchant_id: merchantId,
        p_session_id: sessionId,
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
