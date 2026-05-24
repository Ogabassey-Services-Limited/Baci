import type { SupabaseClient } from '@supabase/supabase-js';
import { getTerminalIdempotencyRecordWindowMs } from '@/env';
import { buildAgenticHealthActions } from '@/lib/agentic/action-health-actions';
import { loadAdminAgenticActionHealthRecords } from '@/lib/agentic/action-health-admin-records';
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
const CHECKOUT_ACTIVITY_RECORD_LIMIT = 5;
const STALE_PAYMENT_PENDING_MS = 24 * 60 * 60 * 1000;
const COMPLETE_ROUTE_SUFFIX = '.complete';

interface LoadAgenticActionHealthOptions {
  onRequestControlError?: (error: unknown) => void;
  recordsSource?: 'admin_direct' | 'dashboard_rpc';
}

function getIdempotencyState(statusCode: number | null) {
  if (statusCode == null) return 'in_progress';
  if (statusCode >= 500) return 'server_error';
  if (statusCode >= 400) return 'client_error';
  return 'completed';
}

function isCompleteMutationRoute(route: string | null): boolean {
  if (!route) return false;
  const normalized = route.trim().toLowerCase();
  return (
    normalized === 'complete' || normalized.endsWith(COMPLETE_ROUTE_SUFFIX)
  );
}

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

function toTimestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function shouldIncludeIdempotencyRow(
  row: { status_code: number | null; updated_at: string },
  nowMs: number
): boolean {
  if (row.status_code == null) return true;

  const updatedAtMs = Date.parse(row.updated_at);
  return (
    Number.isFinite(updatedAtMs) &&
    nowMs - updatedAtMs <= getTerminalIdempotencyRecordWindowMs()
  );
}

async function loadActionHealthRecords(
  supabase: SupabaseClient,
  merchantId: string,
  options: LoadAgenticActionHealthOptions
) {
  if (options.recordsSource === 'admin_direct') {
    return loadAdminAgenticActionHealthRecords(
      supabase,
      merchantId,
      ACTION_HEALTH_RECORD_LIMIT
    );
  }

  const healthResult = await supabase.rpc('get_agentic_action_health_records', {
    p_merchant_id: merchantId,
    p_record_limit: ACTION_HEALTH_RECORD_LIMIT,
  });

  if (healthResult.error) {
    throw healthResult.error;
  }

  return healthResult.data;
}

export async function loadAgenticActionHealth(
  supabase: SupabaseClient,
  merchantId: string,
  options: LoadAgenticActionHealthOptions = {}
): Promise<AgenticActionHealthPayload> {
  const [requestControlSummary, healthPayload] = await Promise.all([
    getActionHealthRequestControlSummary(supabase, merchantId),
    loadActionHealthRecords(supabase, merchantId, options),
  ]);
  if (requestControlSummary.error) {
    options.onRequestControlError?.(requestControlSummary.error);
  }

  const { idempotencyRows, requestRows, sessionRows } =
    parseAgenticActionHealthRpcPayload(healthPayload);
  const nowMs = Date.now();
  const relevantIdempotencyRows = idempotencyRows.filter((row) =>
    shouldIncludeIdempotencyRow(row, nowMs)
  );
  let inProgressCount = 0;
  let staleInProgressCount = 0;
  let completeTerminalErrorCount = 0;
  let terminalErrorCount = 0;

  for (const row of relevantIdempotencyRows) {
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
      if (isCompleteMutationRoute(row.route)) {
        completeTerminalErrorCount += 1;
      }
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

  const checkoutActivityRecords = sessionRows
    .flatMap((row) => {
      const paymentState = getAgenticPaymentState(row.metadata);
      const status =
        typeof row.status === 'string' && row.status.trim().length > 0
          ? row.status.trim()
          : null;
      const sessionId = row.session_id.trim();
      if (
        !paymentState ||
        !status ||
        !sessionId ||
        !Number.isFinite(Date.parse(row.updated_at))
      ) {
        return [];
      }

      return [
        {
          payment_state: paymentState,
          session_id: sessionId,
          status,
          updated_at: row.updated_at,
        },
      ];
    })
    .sort(
      (left, right) =>
        toTimestamp(right.updated_at) - toTimestamp(left.updated_at)
    )
    .slice(0, CHECKOUT_ACTIVITY_RECORD_LIMIT);

  const parsed = agenticActionHealthPayloadSchema.safeParse({
    actions: buildAgenticHealthActions({
      activeInProgressCount: inProgressCount - staleInProgressCount,
      allowlistCount: requestControlSummary.allowlistCount,
      completeTerminalErrorCount,
      isAgenticCheckoutEnabled: requestControlSummary.isAgenticCheckoutEnabled,
      orderFinalizingCount,
      paymentClaimingCount,
      paymentPendingCount: paymentPendingCount - stalePaymentPendingCount,
      paymentSetupFailedCount,
      requestControlFetchError: requestControlSummary.error !== null,
      staleInProgressCount,
      stalePaymentPendingCount,
      terminalErrorCount,
    }),
    checkout_sessions: {
      claiming_payment_count: paymentClaimingCount,
      order_finalizing_count: orderFinalizingCount,
      payment_pending_count: paymentPendingCount,
      payment_setup_failed_count: paymentSetupFailedCount,
      records: checkoutActivityRecords,
      recent_count: sessionRows.length,
      stale_payment_pending_count: stalePaymentPendingCount,
    },
    generated_at: new Date().toISOString(),
    idempotency: {
      active_in_progress_count: inProgressCount - staleInProgressCount,
      in_progress_count: inProgressCount,
      recent_count: relevantIdempotencyRows.length,
      records: relevantIdempotencyRows.map((row) => ({
        created_at: row.created_at,
        expires_at: row.expires_at,
        route:
          typeof row.route === 'string' && row.route.trim().length > 0
            ? row.route.trim()
            : 'unknown',
        state: getIdempotencyState(row.status_code),
        status_code: row.status_code,
        updated_at: row.updated_at,
      })),
      stale_in_progress_count: staleInProgressCount,
      terminal_error_count: terminalErrorCount,
    },
    request_controls: {
      allowlist_count: requestControlSummary.allowlistCount,
      denylist_count: requestControlSummary.denylistCount,
      fetch_error: requestControlSummary.error !== null,
      is_agentic_checkout_enabled:
        requestControlSummary.isAgenticCheckoutEnabled,
    },
    requests: {
      recent_count: requestRows.length,
      records: requestRows.map((row) => ({
        agent_id: row.agent_id,
        api_version: row.api_version,
        created_at: row.created_at,
        expires_at: row.expires_at,
        route: row.route,
      })),
    },
  });

  if (!parsed.success) {
    throw new Error('Invalid agentic action health payload');
  }

  return parsed.data;
}
