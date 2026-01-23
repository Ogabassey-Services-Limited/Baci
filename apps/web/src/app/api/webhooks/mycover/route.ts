import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * MyCover.ai Webhook Handler
 *
 * Receives webhook events for:
 * - Policy purchases
 * - Policy renewals
 * - Claim status updates
 *
 * Security: Verifies HMAC-SHA512 signature using x-mycoverai-signature header
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const myCoverWebhookSecret = process.env.MYCOVER_WEBHOOK_SECRET || '';

/**
 * Verify MyCover webhook signature using HMAC-SHA512
 * Uses Web Crypto API (SubtleCrypto) for Edge Runtime compatibility
 * Implements constant-time comparison to prevent timing attacks
 */
async function verifyWebhookSignature(
  rawBody: string,
  signature: string | null
): Promise<boolean> {
  if (!signature || !myCoverWebhookSecret) {
    return false;
  }

  try {
    // Encode the secret and body for Web Crypto API
    const encoder = new TextEncoder();
    const keyData = encoder.encode(myCoverWebhookSecret);
    const messageData = encoder.encode(rawBody);

    // Import the secret as an HMAC key
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    );

    // Generate the expected signature
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      messageData
    );
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Constant-time comparison to prevent timing attacks
    if (signature.length !== expectedSignature.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }

    return result === 0;
  } catch (error) {
    console.error('[MyCover Webhook] Signature verification error:', error);
    return false;
  }
}

interface MyCoverWebhookPayload {
  event: string;
  data: {
    policy_id?: string;
    policy_number?: string;
    status?: string;
    customer?: {
      email?: string;
      phone?: string;
      first_name?: string;
      last_name?: string;
    };
    start_date?: string;
    expiration_date?: string;
    genius_price?: number;
    market_price?: number;
    claim_id?: string;
    claim_status?: string;
    [key: string]: unknown;
  };
  timestamp?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Read raw body for signature verification
    const rawBody = await request.text();

    // Verify webhook signature (2026 security best practice)
    const signature = request.headers.get('x-mycoverai-signature');
    const isValid = await verifyWebhookSignature(rawBody, signature);

    if (!isValid) {
      console.warn('[MyCover Webhook] Invalid or missing signature');
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    // Parse payload after signature verification
    const payload: MyCoverWebhookPayload = JSON.parse(rawBody);

    // Log incoming webhook for debugging (sanitize to prevent log injection)
    const safeEvent = String(payload.event || '').replace(/[\r\n]/g, '');
    console.log('[MyCover Webhook] Received:', safeEvent);

    // Create admin Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    switch (payload.event) {
      case 'policy.purchased':
      case 'policy.created':
        await handlePolicyPurchased(supabase, payload.data);
        break;

      case 'policy.renewed':
        await handlePolicyRenewed(supabase, payload.data);
        break;

      case 'policy.expired':
        await handlePolicyExpired(supabase, payload.data);
        break;

      case 'claim.submitted':
      case 'claim.approved':
      case 'claim.rejected':
        await handleClaimUpdate(supabase, payload);
        break;

      default:
        console.log('[MyCover Webhook] Unhandled event:', safeEvent);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[MyCover Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handlePolicyPurchased(
  supabase: SupabaseClient,
  data: MyCoverWebhookPayload['data']
) {
  if (!data.policy_id) {
    console.warn('[MyCover Webhook] Policy purchased without policy_id');
    return;
  }

  // Update the policy record with confirmed details from MyCover
  const { error } = await supabase
    .from('order_insurance_policies')
    .update({
      mycover_policy_number: data.policy_number,
      policy_start_date: data.start_date,
      policy_expiry_date: data.expiration_date,
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('mycover_policy_id', data.policy_id);

  if (error) {
    console.error('[MyCover Webhook] Failed to update policy:', error);
  } else {
    // Sanitize policy_id before logging to prevent log injection
    const safePolicyId = String(data.policy_id || '').replace(/[\r\n]/g, '');
    console.log('[MyCover Webhook] Policy confirmed:', safePolicyId);
  }
}

async function handlePolicyRenewed(
  supabase: SupabaseClient,
  data: MyCoverWebhookPayload['data']
) {
  if (!data.policy_id) return;

  const { error } = await supabase
    .from('order_insurance_policies')
    .update({
      policy_expiry_date: data.expiration_date,
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('mycover_policy_id', data.policy_id);

  if (error) {
    console.error('[MyCover Webhook] Failed to renew policy:', error);
  }
}

async function handlePolicyExpired(
  supabase: SupabaseClient,
  data: MyCoverWebhookPayload['data']
) {
  if (!data.policy_id) return;

  const { error } = await supabase
    .from('order_insurance_policies')
    .update({
      status: 'expired',
      updated_at: new Date().toISOString(),
    })
    .eq('mycover_policy_id', data.policy_id);

  if (error) {
    console.error('[MyCover Webhook] Failed to expire policy:', error);
  }
}

async function handleClaimUpdate(
  supabase: SupabaseClient,
  payload: MyCoverWebhookPayload
) {
  const { event, data } = payload;
  if (!data.policy_id) return;

  let claimStatus: string;
  switch (event) {
    case 'claim.submitted':
      claimStatus = 'pending';
      break;
    case 'claim.approved':
      claimStatus = 'approved';
      break;
    case 'claim.rejected':
      claimStatus = 'rejected';
      break;
    default:
      claimStatus = 'unknown';
  }

  const { error } = await supabase
    .from('order_insurance_policies')
    .update({
      claim_status: claimStatus,
      claim_id: data.claim_id,
      status: event === 'claim.approved' ? 'claimed' : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('mycover_policy_id', data.policy_id);

  if (error) {
    console.error('[MyCover Webhook] Failed to update claim:', error);
  }
}

// Allow GET for webhook URL verification
export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'MyCover.ai Webhook Handler',
    timestamp: new Date().toISOString(),
  });
}
