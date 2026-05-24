import type { SupabaseClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { getMyCoverWebhookSecret } from '@/env';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import { createServiceClient } from '@/lib/supabase/service';
import {
  type MyCoverWebhookPayload,
  myCoverWebhookSchema,
} from '@/schemas/mycover-webhook';

type MyCoverPolicyLookup = {
  column: 'mycover_policy_id' | 'mycover_purchase_id';
  value: string;
};

type MyCoverUpdatedPolicy = {
  id: string;
};

const MYCOVER_RENEWAL_DETAILS_URL = 'https://api.mycover.ai/v1/renewals';

async function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature) {
    console.warn('[MyCover Webhook] Missing signature header');
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(rawBody);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      messageData
    );
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return constantTimeEqual(signature, expectedSignature);
  } catch (error) {
    console.error('[MyCover Webhook] Signature verification error:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    let myCoverWebhookSecret: string;
    try {
      myCoverWebhookSecret = getMyCoverWebhookSecret();
    } catch (error) {
      console.error(
        '[MyCover Webhook] MYCOVER_WEBHOOK_SECRET or MYCOVER_SECRET_KEY is not configured in environment variables',
        error
      );
      return NextResponse.json(
        { error: 'Webhook configuration error' },
        { status: 500 }
      );
    }

    const signature = request.headers.get('x-mycoverai-signature');
    const isValid = await verifyWebhookSignature(
      rawBody,
      signature,
      myCoverWebhookSecret
    );

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid or missing webhook signature' },
        { status: 401 }
      );
    }

    // Parse payload after signature verification
    // 2026 Best Practice: Return 400 for malformed JSON or schema failure (client error)
    let jsonPayload: unknown;
    try {
      jsonPayload = JSON.parse(rawBody);
    } catch {
      console.warn('[MyCover Webhook] Invalid JSON payload');
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const parseResult = myCoverWebhookSchema.safeParse(jsonPayload);
    if (!parseResult.success) {
      console.warn(
        '[MyCover Webhook] Invalid payload structure:',
        parseResult.error.format()
      );
      return NextResponse.json(
        { error: 'Invalid payload structure' },
        { status: 400 }
      );
    }

    const payload = parseResult.data;

    // Log incoming webhook for debugging (sanitize to prevent log injection)
    const safeEvent = String(payload.event || '').replace(/[\r\n]/g, '');
    console.log('[MyCover Webhook] Received:', safeEvent);

    // Create admin Supabase client (2026 Best Practice: Use centralized factory)
    const supabase = createServiceClient();

    switch (payload.event) {
      case 'policy.purchased':
      case 'policy.created':
      case 'purchase.successful':
        await handlePolicyPurchased(supabase, payload.data, payload.event);
        break;

      case 'policy.renewed':
      case 'renewal.successful':
        await handlePolicyRenewed(
          supabase,
          payload.data,
          payload.event,
          myCoverWebhookSecret
        );
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
  data: MyCoverWebhookPayload['data'],
  event: MyCoverWebhookPayload['event']
) {
  const lookup = getPolicyLookup(data, {
    dataIdColumn:
      event === 'purchase.successful'
        ? 'mycover_purchase_id'
        : 'mycover_policy_id',
  });
  if (!lookup) {
    console.warn('[MyCover Webhook] Policy purchased without policy_id');
    return;
  }

  const { data: updatedPolicy, error } = await supabase
    .from('order_insurance_policies')
    .update({
      mycover_policy_number: data.policy_number,
      policy_start_date: getPolicyStartDate(data),
      policy_expiry_date: getPolicyExpiryDate(data),
      certificate_url: data.certificate_url,
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq(lookup.column, lookup.value)
    .select('id')
    .maybeSingle<MyCoverUpdatedPolicy>();

  if (error) {
    console.error('[MyCover Webhook] Failed to update policy:', error);
    throw error;
  }

  if (!updatedPolicy) {
    throw new Error('MyCover purchase webhook did not match a stored policy');
  }

  const safeIdentifier = lookup.value.replace(/[\r\n]/g, '');
  console.log('[MyCover Webhook] Policy confirmed:', safeIdentifier);
}

function getPolicyId(data: MyCoverWebhookPayload['data']) {
  return data.policy_id || data.id;
}

function getExplicitPolicyId(data: MyCoverWebhookPayload['data']) {
  return data.policy_id || null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(
  sources: readonly Record<string, unknown>[],
  keys: readonly string[]
): string | null {
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }
  }

  return null;
}

function getLookupFromRenewalDetails(
  response: unknown
): MyCoverPolicyLookup | null {
  const data = asRecord(asRecord(response).data);
  const policy = asRecord(data.policy);
  const purchase = asRecord(data.purchase);

  const policyId =
    readString([data], ['policy_id', 'mycover_policy_id']) ??
    readString([policy], ['id', 'policy_id']);
  if (policyId) {
    return { column: 'mycover_policy_id', value: policyId };
  }

  const purchaseId =
    readString([data], ['purchase_id', 'mycover_purchase_id']) ??
    readString([purchase], ['id', 'purchase_id']);
  if (purchaseId) {
    return { column: 'mycover_purchase_id', value: purchaseId };
  }

  return null;
}

async function resolveRenewalPolicyLookup(
  renewalId: string,
  configuredSecret: string
): Promise<MyCoverPolicyLookup | null> {
  const secretKey =
    process.env.MYCOVER_SECRET_KEY?.trim() || configuredSecret.trim();
  if (!secretKey) return null;

  const response = await fetch(
    `${MYCOVER_RENEWAL_DETAILS_URL}/${encodeURIComponent(renewalId)}`,
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${secretKey}`,
      },
      signal: AbortSignal.timeout(10_000),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to resolve MyCover renewal details');
  }

  return getLookupFromRenewalDetails(await response.json());
}

function getPolicyLookup(
  data: MyCoverWebhookPayload['data'],
  {
    dataIdColumn = 'mycover_policy_id',
  }: {
    dataIdColumn?: MyCoverPolicyLookup['column'] | null;
  } = {}
): MyCoverPolicyLookup | null {
  if (data.policy_id) {
    return { column: 'mycover_policy_id', value: data.policy_id };
  }

  if (data.purchase_id) {
    return { column: 'mycover_purchase_id', value: data.purchase_id };
  }

  if (!(data.id && dataIdColumn)) {
    return null;
  }

  return {
    column: dataIdColumn,
    value: data.id,
  };
}

function getPolicyStartDate(data: MyCoverWebhookPayload['data']) {
  return data.start_date || data.policy_start_date;
}

function getPolicyExpiryDate(data: MyCoverWebhookPayload['data']) {
  return data.expiration_date || data.policy_expiry_date;
}

async function handlePolicyRenewed(
  supabase: SupabaseClient,
  data: MyCoverWebhookPayload['data'],
  event: MyCoverWebhookPayload['event'],
  configuredSecret: string
) {
  let lookup = getPolicyLookup(data, {
    dataIdColumn: event === 'renewal.successful' ? null : 'mycover_policy_id',
  });
  if (!lookup && event === 'renewal.successful' && data.id) {
    lookup = await resolveRenewalPolicyLookup(data.id, configuredSecret);
  }

  if (!lookup) {
    throw new Error(
      'MyCover renewal webhook missing stored policy or purchase identifier'
    );
  }

  const { data: updatedPolicy, error } = await supabase
    .from('order_insurance_policies')
    .update({
      policy_expiry_date: getPolicyExpiryDate(data),
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq(lookup.column, lookup.value)
    .select('id')
    .maybeSingle<MyCoverUpdatedPolicy>();

  if (error) {
    console.error('[MyCover Webhook] Failed to renew policy:', error);
    throw error;
  }

  if (!updatedPolicy) {
    throw new Error('MyCover renewal webhook did not match a stored policy');
  }
}

async function handlePolicyExpired(
  supabase: SupabaseClient,
  data: MyCoverWebhookPayload['data']
) {
  const policyId = getPolicyId(data);
  if (!policyId) return;

  const { error } = await supabase
    .from('order_insurance_policies')
    .update({
      status: 'expired',
      updated_at: new Date().toISOString(),
    })
    .eq('mycover_policy_id', policyId);

  if (error) {
    console.error('[MyCover Webhook] Failed to expire policy:', {
      error,
      policyId,
    });
    throw error;
  }
}

async function handleClaimUpdate(
  supabase: SupabaseClient,
  payload: MyCoverWebhookPayload
) {
  const { event, data } = payload;
  const policyId = getExplicitPolicyId(data);
  if (!policyId) return;

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

  // 2026 Best Practice: Explicit conditional updates for clarity and type safety
  const updateData: {
    claim_status: string;
    claim_id: string | undefined;
    updated_at: string;
    status?: string;
  } = {
    claim_status: claimStatus,
    claim_id: data.claim_id,
    updated_at: new Date().toISOString(),
  };

  if (event === 'claim.approved') {
    updateData.status = 'claimed';
  }

  const { error } = await supabase
    .from('order_insurance_policies')
    .update(updateData)
    .eq('mycover_policy_id', policyId);

  if (error) {
    console.error('[MyCover Webhook] Failed to update claim:', {
      claimId: data.claim_id,
      error,
      policyId,
    });
    throw error;
  }
}

export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'MyCover.ai Webhook Handler',
    timestamp: new Date().toISOString(),
  });
}
