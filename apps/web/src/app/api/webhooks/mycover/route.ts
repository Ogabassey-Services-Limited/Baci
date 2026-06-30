import { type NextRequest, NextResponse } from 'next/server';
import { getMyCoverWebhookSecret } from '@/env';
import { createServiceClient } from '@/lib/supabase/service';
import {
  type MyCoverWebhookPayload,
  myCoverWebhookSchema,
} from '@/schemas/mycover-webhook';
import {
  handleClaimUpdate,
  handleInspectionCompleted,
} from './webhook-claim-inspection-handlers';
import {
  claimMyCoverWebhookEvent,
  completeMyCoverWebhookEventClaim,
  releaseMyCoverWebhookEventClaim,
} from './webhook-event-claims';
import {
  handlePolicyExpired,
  handlePolicyPurchased,
  handlePolicyRenewed,
  handlePolicyUpdated,
} from './webhook-policy-handlers';
import { verifyWebhookSignature } from './webhook-signature';

async function parseVerifiedMyCoverPayload(
  request: NextRequest,
  webhookSecret: string
): Promise<
  | { payload: MyCoverWebhookPayload; rawBody: string }
  | { response: NextResponse }
> {
  const rawBody = await request.text();
  const signature = request.headers.get('x-mycoverai-signature');
  const isValid = await verifyWebhookSignature(
    rawBody,
    signature,
    webhookSecret
  );

  if (!isValid) {
    return {
      response: NextResponse.json(
        { error: 'Invalid or missing webhook signature' },
        { status: 401 }
      ),
    };
  }

  // Parse payload after signature verification.
  let jsonPayload: unknown;
  try {
    jsonPayload = JSON.parse(rawBody);
  } catch {
    console.warn('[MyCover Webhook] Invalid JSON payload');
    return {
      response: NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      ),
    };
  }

  const parseResult = myCoverWebhookSchema.safeParse(jsonPayload);
  if (!parseResult.success) {
    console.warn(
      '[MyCover Webhook] Invalid payload structure:',
      parseResult.error.format()
    );
    return {
      response: NextResponse.json(
        { error: 'Invalid payload structure' },
        { status: 400 }
      ),
    };
  }

  return { payload: parseResult.data, rawBody };
}

async function dispatchMyCoverEvent(
  payload: MyCoverWebhookPayload,
  myCoverWebhookSecret: string
): Promise<NextResponse | null> {
  const supabase = createServiceClient();
  const safeEvent = String(payload.event || '').replace(/[\r\n]/g, '');

  // MyCover documents `event_id` as the dedupe key. Claim it before any
  // side effects so concurrent retries cannot both process the same event.
  let eventClaimReceivedAt: string | null = null;

  if (payload.event_id) {
    const claimResult = await claimMyCoverWebhookEvent(supabase, payload);
    if (claimResult.status === 'processed_duplicate') {
      return NextResponse.json({ received: true, duplicate: true });
    }
    if (claimResult.status === 'processing_duplicate') {
      return NextResponse.json(
        { error: 'Webhook event is still processing', retry: true },
        { status: 409 }
      );
    }
    eventClaimReceivedAt = claimResult.receivedAt;
  }

  let releaseClaimOnError = true;

  try {
    // The top-level `status` is the operation outcome. Don't mutate state on a
    // failed operation — acknowledge so MyCover stops retrying. Normalize case /
    // whitespace so "Failed"/"FAILED" are also fail-closed.
    if (payload.status?.trim().toLowerCase() === 'failed') {
      console.log('[MyCover Webhook] Skipping failed-status event:', safeEvent);
      if (payload.event_id) {
        await completeMyCoverWebhookEventClaim(
          supabase,
          payload.event_id,
          eventClaimReceivedAt
        );
      }
      return NextResponse.json({ received: true, skipped: 'failed_status' });
    }

    switch (payload.event) {
      case 'purchase.successful':
      case 'policy.purchased':
      case 'policy.created':
        await handlePolicyPurchased(supabase, payload.data, payload.event);
        break;
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
      case 'policy.updated':
        await handlePolicyUpdated(supabase, payload.data);
        break;
      case 'policy.expired':
        await handlePolicyExpired(supabase, payload.data);
        break;
      case 'claim.submitted':
      case 'claim.approved':
      case 'claim.disapproved':
      case 'claim.offer_sent':
      case 'claim.offer_accepted':
      case 'claim.offer_rejected':
      case 'claim.paid':
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

    if (payload.event_id) {
      releaseClaimOnError = false;
      await completeMyCoverWebhookEventClaim(
        supabase,
        payload.event_id,
        eventClaimReceivedAt
      );
    }
  } catch (error) {
    if (payload.event_id && releaseClaimOnError) {
      await releaseMyCoverWebhookEventClaim(
        supabase,
        payload.event_id,
        eventClaimReceivedAt
      );
    }
    throw error;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
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

    const parsed = await parseVerifiedMyCoverPayload(
      request,
      myCoverWebhookSecret
    );
    if ('response' in parsed) return parsed.response;

    const safeEvent = String(parsed.payload.event || '').replace(/[\r\n]/g, '');
    console.log('[MyCover Webhook] Received:', safeEvent);

    const dispatchResponse = await dispatchMyCoverEvent(
      parsed.payload,
      myCoverWebhookSecret
    );
    if (dispatchResponse) return dispatchResponse;

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[MyCover Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'MyCover.ai Webhook Handler',
    timestamp: new Date().toISOString(),
  });
}
