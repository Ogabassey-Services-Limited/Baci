import type { SupabaseClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { getMyCoverWebhookSecret } from '@/env';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import {
  claimStatusLabel,
  normalizeClaimStatus,
} from '@/lib/insurance/claim-status';
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
    // MyCover's docs sign a re-serialized `JSON.stringify(body)` (Node) /
    // compact `json.dumps` (Python). To be robust to whichever canonical form
    // arrives on the wire, accept a match against either the verbatim received
    // body or its canonical re-serialization. Both require the secret, so this
    // is not a security weakening.
    const candidates = [rawBody];
    try {
      candidates.push(JSON.stringify(JSON.parse(rawBody)));
    } catch {
      // rawBody isn't JSON-parseable — only the verbatim candidate applies.
    }

    for (const message of candidates) {
      const expectedSignature = await hmacSha512Hex(secret, message);
      if (constantTimeEqual(signature, expectedSignature)) {
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('[MyCover Webhook] Signature verification error:', error);
    return false;
  }
}

async function hmacSha512Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(message)
  );
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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

    // Idempotency: MyCover retries a delivery up to ~10 times with a stable
    // `event_id`. Check first; we only record it AFTER successful processing
    // (below) so a transient failure can still be retried.
    if (payload.event_id) {
      const { data: alreadyProcessed } = await supabase
        .from('mycover_webhook_events')
        .select('event_id')
        .eq('event_id', payload.event_id)
        .maybeSingle();
      if (alreadyProcessed) {
        return NextResponse.json({ received: true, duplicate: true });
      }
    }

    // The top-level `status` is the operation outcome. Don't mutate state on a
    // failed operation — acknowledge so MyCover stops retrying.
    if (payload.status === 'failed') {
      console.log('[MyCover Webhook] Skipping failed-status event:', safeEvent);
      return NextResponse.json({ received: true, skipped: 'failed_status' });
    }

    switch (payload.event) {
      // Purchase / activation. Documented event is `purchase.successful`; the
      // others are legacy names kept for tolerance.
      case 'purchase.successful':
      case 'policy.purchased':
      case 'policy.created':
        await handlePolicyPurchased(supabase, payload.data, payload.event);
        break;

      // Renewal. Documented event is `purchase.renewed`.
      case 'purchase.renewed':
      case 'policy.renewed':
      case 'renewal.successful':
        await handlePolicyRenewed(
          supabase,
          payload.data,
          payload.event,
          myCoverWebhookSecret
        );
        break;

      // Certificate regeneration / policy detail edits.
      case 'policy.updated':
        await handlePolicyUpdated(supabase, payload.data);
        break;

      case 'policy.expired':
        await handlePolicyExpired(supabase, payload.data);
        break;

      // Full claim lifecycle. `data.essential.status` carries the real state.
      case 'claim.submitted':
      case 'claim.approved':
      case 'claim.disapproved':
      case 'claim.offer_sent':
      case 'claim.offer_rejected':
      case 'claim.updated':
      case 'claim.rejected':
        await handleClaimUpdate(supabase, payload);
        break;

      case 'inspection.completed':
        await handleInspectionCompleted(supabase, payload.data);
        break;

      default:
        console.log('[MyCover Webhook] Unhandled event:', safeEvent);
    }

    // Processing succeeded — persist the event_id so retries are deduplicated.
    // A unique-violation here just means a concurrent delivery won the race.
    if (payload.event_id) {
      const { error: recordError } = await supabase
        .from('mycover_webhook_events')
        .insert({ event_id: payload.event_id, event: payload.event });
      if (recordError && recordError.code !== '23505') {
        console.error(
          '[MyCover Webhook] Failed to record event_id:',
          recordError
        );
      }
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
      mycover_policy_number: getPolicyNumber(data),
      policy_start_date: getPolicyStartDate(data),
      policy_expiry_date: getPolicyExpiryDate(data),
      certificate_url: getCertificateUrl(data),
      status: 'active',
      updated_at: new Date().toISOString(),
      // Hosted flows for filing a claim / completing a device inspection.
      ...getHostedFlowLinks(data),
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

/**
 * Mark a policy's pre-loss inspection complete so the storefront switches the
 * action from "Complete Inspection" to "File a Claim".
 *
 * Only the post-purchase activation inspection (`category: 'preloss'`) flips
 * this flag; post-loss inspections happen inside an existing claim and must not
 * reset the policy's claim affordance.
 */
async function handleInspectionCompleted(
  supabase: SupabaseClient,
  data: MyCoverWebhookPayload['data']
) {
  if (data.essential?.category !== 'preloss') {
    return;
  }

  const policyId =
    data.essential?.policy_id || data.meta?.policy_id || data.policy_id;
  if (!policyId) {
    console.warn('[MyCover Webhook] inspection.completed without policy_id');
    return;
  }

  const { data: updatedPolicy, error } = await supabase
    .from('order_insurance_policies')
    .update({
      inspection_status: 'completed',
      updated_at: new Date().toISOString(),
    })
    .eq('mycover_policy_id', policyId)
    .select('id')
    .maybeSingle<MyCoverUpdatedPolicy>();

  if (error) {
    console.error(
      '[MyCover Webhook] Failed to mark inspection complete:',
      error
    );
    throw error;
  }

  const safeIdentifier = policyId.replace(/[\r\n]/g, '');

  // No-op (not an error): the same MyCover account also emits inspection
  // webhooks for policies we don't store (test account, other channels).
  if (!updatedPolicy) {
    console.warn(
      '[MyCover Webhook] inspection.completed matched no stored policy:',
      safeIdentifier
    );
    return;
  }

  console.log(
    '[MyCover Webhook] Pre-loss inspection completed:',
    safeIdentifier
  );
}

/**
 * Build the partial update for MyCover's hosted claim/inspection links.
 *
 * Keys are only included when present so we never overwrite a previously
 * stored link with `undefined` on webhooks that omit `data.sdk`.
 */
function getHostedFlowLinks(data: MyCoverWebhookPayload['data']): {
  claim_link?: string;
  inspection_link?: string;
} {
  const links: { claim_link?: string; inspection_link?: string } = {};
  const claimLink = data.sdk?.claim_link;
  const inspectionLink = data.sdk?.inspection_link;
  if (claimLink) links.claim_link = claimLink;
  if (inspectionLink) links.inspection_link = inspectionLink;
  return links;
}

function getPolicyId(data: MyCoverWebhookPayload['data']) {
  return (
    data.essential?.policy_id ||
    data.meta?.policy_id ||
    data.policy_id ||
    data.id
  );
}

function getExplicitPolicyId(data: MyCoverWebhookPayload['data']) {
  return (
    data.essential?.policy_id || data.meta?.policy_id || data.policy_id || null
  );
}

function getPolicyNumber(data: MyCoverWebhookPayload['data']) {
  return data.essential?.policy_number || data.policy_number;
}

function getCertificateUrl(data: MyCoverWebhookPayload['data']) {
  return data.essential?.certificate_url || data.certificate_url;
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
  const policyId =
    data.essential?.policy_id || data.meta?.policy_id || data.policy_id;
  if (policyId) {
    return { column: 'mycover_policy_id', value: policyId };
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
  return (
    data.essential?.expiration_date ||
    data.expiration_date ||
    data.policy_expiry_date
  );
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

/**
 * Handle `policy.updated` — chiefly certificate (re)generation, but also policy
 * detail edits. Best-effort: a policy we don't track simply matches no row.
 */
async function handlePolicyUpdated(
  supabase: SupabaseClient,
  data: MyCoverWebhookPayload['data']
) {
  const lookup = getPolicyLookup(data, { dataIdColumn: 'mycover_policy_id' });
  if (!lookup) return;

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  const certificateUrl = getCertificateUrl(data);
  const policyNumber = getPolicyNumber(data);
  const expiryDate = getPolicyExpiryDate(data);
  if (certificateUrl) update.certificate_url = certificateUrl;
  if (policyNumber) update.mycover_policy_number = policyNumber;
  if (expiryDate) update.policy_expiry_date = expiryDate;

  const { error } = await supabase
    .from('order_insurance_policies')
    .update(update)
    .eq(lookup.column, lookup.value);

  if (error) {
    console.error('[MyCover Webhook] Failed to apply policy.updated:', error);
    throw error;
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

  // The authoritative claim state is `data.essential.status`; fall back to the
  // event name. `data.meta.progress` is the workflow milestone and
  // `data.essential.comment` carries decline/rejection reasons.
  const rawStatus = data.essential?.status;
  const token = normalizeClaimStatus(rawStatus, event);
  const stage = rawStatus?.trim() || claimStatusLabel(token);

  const updateData: Record<string, unknown> = {
    claim_status: token,
    claim_stage: stage,
    claim_progress: data.meta?.progress ?? null,
    claim_comment: data.essential?.comment ?? data.meta?.comment ?? null,
    updated_at: new Date().toISOString(),
  };
  if (data.claim_id) updateData.claim_id = data.claim_id;
  if (token === 'approved' || token === 'paid') {
    updateData.status = 'claimed';
  }

  const { error } = await supabase
    .from('order_insurance_policies')
    .update(updateData)
    .eq('mycover_policy_id', policyId);

  if (error) {
    console.error('[MyCover Webhook] Failed to update claim:', {
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
