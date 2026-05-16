import type { SupabaseClient } from '@supabase/supabase-js';
import { buildAgenticHealthActions } from '@/lib/agentic/action-health-actions';
import { getActionHealthRequestControlSummary } from '@/lib/agentic/action-health-request-controls';
import {
  getAgenticPaymentState,
  parseAgenticActionHealthRpcPayload,
} from '@/lib/agentic/action-health-rpc-payload';
import {
  type AgenticActionHealthPayload,
  agenticActionHealthPayloadSchema,
} from '@/schemas/agentic-action-health';

const ACTION_HEALTH_RECORD_LIMIT = 25;
const STALE_PAYMENT_PENDING_MS = 24 * 60 * 60 * 1000;

function isExpiredInProgressReservation({
  expiresAt,
  nowMs,
  statusCode = null,
}: {
  expiresAt: string;
  nowMs: number;
  statusCode?: number | null;
}) {
  if (statusCode !== null) return false;

  const expiresAtMs = Date.parse(expiresAt);
  return Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs;
}

function isStalePaymentPendingSession({
  nowMs,
  updatedAt,
}: {
  nowMs: number;
  updatedAt: string;
}) {
  const updatedAtMs = Date.parse(updatedAt);
  return (
    Number.isFinite(updatedAtMs) &&
    nowMs - updatedAtMs >= STALE_PAYMENT_PENDING_MS
  );
}

export async function loadAgenticActionHealth(
  supabase: SupabaseClient,
  merchantId: string
): Promise<AgenticActionHealthPayload> {
  const [requestControlSummary, healthResult] = await Promise.all([
    getActionHealthRequestControlSummary(supabase, merchantId),
    supabase.rpc('get_agentic_action_health_records', {
      p_merchant_id: merchantId,
      p_record_limit: ACTION_HEALTH_RECORD_LIMIT,
    }),
  ]);

  if (healthResult.error) {
    throw healthResult.error;
  }

  const { idempotencyRows, sessionRows } = parseAgenticActionHealthRpcPayload(
    healthResult.data
  );
  const nowMs = Date.now();
  let inProgressCount = 0;
  let staleInProgressCount = 0;
  let terminalErrorCount = 0;

  for (const row of idempotencyRows) {
    if (row.status_code == null) {
      inProgressCount += 1;
      if (
        isExpiredInProgressReservation({
          expiresAt: row.expires_at,
          nowMs,
        })
      ) {
        staleInProgressCount += 1;
      }
      continue;
    }

    if (row.status_code >= 500) {
      terminalErrorCount += 1;
    }
  }

  let orderFinalizingCount = 0;
  let paymentClaimingCount = 0;
  let paymentPendingCount = 0;
  let paymentSetupFailedCount = 0;
  let stalePaymentPendingCount = 0;

  for (const row of sessionRows) {
    const paymentState = getAgenticPaymentState(row.metadata);
    switch (paymentState) {
      case 'claiming_payment':
        paymentClaimingCount += 1;
        break;
      case 'order_finalizing':
        orderFinalizingCount += 1;
        break;
      case 'payment_pending':
        paymentPendingCount += 1;
        if (
          isStalePaymentPendingSession({
            nowMs,
            updatedAt: row.updated_at,
          })
        ) {
          stalePaymentPendingCount += 1;
        }
        break;
      case 'payment_setup_failed':
        paymentSetupFailedCount += 1;
        break;
    }
  }

  const parsed = agenticActionHealthPayloadSchema.safeParse({
    actions: buildAgenticHealthActions({
      activeInProgressCount: inProgressCount - staleInProgressCount,
      allowlistCount: requestControlSummary.allowlistCount,
      isAgenticCheckoutEnabled: requestControlSummary.isAgenticCheckoutEnabled,
      orderFinalizingCount,
      paymentClaimingCount,
      paymentPendingCount: paymentPendingCount - stalePaymentPendingCount,
      paymentSetupFailedCount,
      staleInProgressCount,
      stalePaymentPendingCount,
      terminalErrorCount,
    }),
    checkout_sessions: {
      claiming_payment_count: paymentClaimingCount,
      order_finalizing_count: orderFinalizingCount,
      payment_pending_count: paymentPendingCount,
      payment_setup_failed_count: paymentSetupFailedCount,
      recent_count: sessionRows.length,
      stale_payment_pending_count: stalePaymentPendingCount,
    },
    generated_at: new Date().toISOString(),
  });

  if (!parsed.success) {
    throw new Error('Invalid agentic action health payload');
  }

  return parsed.data;
}
