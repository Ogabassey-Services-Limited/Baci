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
import { createAdminClient } from '@/lib/supabase/admin';

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
 * - orderId?: string (optional, for linking)
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
    if (!customerEmail || !totalAmount || !merchantSlug) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: customerEmail, totalAmount, merchantSlug',
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

    // Get merchant and verify Credit Direct is enabled
    // Use admin client to ensure we can read settings regardless of RLS policies
    const supabase = createAdminClient();

    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id, slug')
      .eq('slug', merchantSlug)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Check if Credit Direct is enabled for this merchant
    const { data: settings, error: settingsError } = await supabase
      .from('merchant_feature_settings')
      .select(
        'credit_direct_enabled, credit_direct_public_key, credit_direct_min_amount, credit_direct_max_amount'
      )
      .eq('merchant_id', merchant.id)
      .maybeSingle();

    console.log('Credit Direct Sign Debug:', {
      requestSlug: merchantSlug,
      foundMerchantId: merchant.id,
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

    // If orderId provided, store the session mapping for webhook reconciliation
    if (orderId) {
      await supabase
        .from('orders')
        .update({
          payment_method: 'credit_direct',
          payment_status: 'bnpl_pending',
          notes: JSON.stringify({
            creditDirectSessionId: sessionId,
            ...(JSON.parse(
              (
                await supabase
                  .from('orders')
                  .select('notes')
                  .eq('id', orderId)
                  .single()
              ).data?.notes || '{}'
            ) || {}),
          }),
        })
        .eq('id', orderId);
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
