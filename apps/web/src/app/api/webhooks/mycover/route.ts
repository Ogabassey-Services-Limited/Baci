import crypto from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { getMyCoverSecretKey } from '@/env';

/**
 * MyCover.ai Webhook Handler
 *
 * Receives webhook events for:
 * - Policy purchases
 * - Policy renewals
 * - Claim status updates
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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

/**
 * Verify MyCover webhook signature
 * Note: Checks both SHA512 and SHA256 as algorithm wasn't explicitly documented
 */
function verifySignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  try {
    const signatureBuffer = Buffer.from(signature);

    // Try HMAC-SHA512 (Common in fintech)
    const hash512 = crypto
      .createHmac('sha512', secret)
      .update(rawBody)
      .digest('hex');
    const buffer512 = Buffer.from(hash512);

    if (
      signatureBuffer.length === buffer512.length &&
      crypto.timingSafeEqual(signatureBuffer, buffer512)
    ) {
      return true;
    }

    // Try HMAC-SHA256 (Standard)
    const hash256 = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    const buffer256 = Buffer.from(hash256);

    if (
      signatureBuffer.length === buffer256.length &&
      crypto.timingSafeEqual(signatureBuffer, buffer256)
    ) {
      return true;
    }

    return false;
  } catch (err) {
    console.error('[MyCover Webhook] Signature verification error:', err);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    let payload: MyCoverWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Security: Verify Signature
    const secretKey = getMyCoverSecretKey();
    if (secretKey) {
      const signature =
        request.headers.get('x-mycover-signature') ||
        request.headers.get('x-signature');

      if (signature) {
        const isValid = verifySignature(rawBody, signature, secretKey);
        if (!isValid) {
          console.error(
            '[MyCover Webhook] 🚨 Signature verification FAILED. Possible spoofing attempt.'
          );
          // TODO: Enforce signature verification (return 401) once header/algo is confirmed in production
        } else {
          console.log('[MyCover Webhook] ✅ Signature verified.');
        }
      } else {
        console.warn(
          '[MyCover Webhook] ⚠️ No signature header found (x-mycover-signature or x-signature).'
        );
      }
    } else if (process.env.NODE_ENV === 'production') {
      // In production, we should probably warn louder if secret is missing
      console.warn(
        '[MyCover Webhook] ⚠️ MYCOVER_SECRET_KEY not configured. Cannot verify webhook authenticity.'
      );
    }

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
