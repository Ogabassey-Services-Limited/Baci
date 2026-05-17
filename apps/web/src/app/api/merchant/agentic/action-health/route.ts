import type { SupabaseClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { buildAgenticHealthActions } from '@/lib/agentic/action-health-actions';
import { getActionHealthRequestControlSummary } from '@/lib/agentic/action-health-request-controls';
import {
  getAgenticPaymentState,
  parseAgenticActionHealthRpcPayload,
} from '@/lib/agentic/action-health-rpc-payload';
import { authenticateApiRequest, hasPermission } from '@/lib/api-auth';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { logger } from '@/lib/logger';
import { sanitizeForLog } from '@/lib/sanitize-core';

const RECENT_RECORD_LIMIT = 25;
const STALE_PAYMENT_PENDING_MS = 24 * 60 * 60 * 1000;
const COMPLETE_ROUTE_SUFFIX = '.complete';

function getIdempotencyState(statusCode: number | null) {
  if (statusCode == null) return 'in_progress';
  if (statusCode >= 500) return 'server_error';
  if (statusCode >= 400) return 'client_error';
  return 'completed';
}

function isCompleteMutationRoute(route: string | null) {
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

async function loadAgenticActionHealth(
  supabase: SupabaseClient,
  merchantId: string
) {
  const [requestControlSummary, healthResult] = await Promise.all([
    getActionHealthRequestControlSummary(supabase, merchantId),
    supabase.rpc('get_agentic_action_health_records', {
      p_merchant_id: merchantId,
      p_record_limit: RECENT_RECORD_LIMIT,
    }),
  ]);
  if (requestControlSummary.error) {
    logger.warn({
      error: sanitizeForLog(requestControlSummary.error),
      merchantId,
      message: 'Failed to load agentic request controls for action health',
    });
  }

  if (healthResult.error) {
    return {
      error: healthResult.error,
      ok: false as const,
    };
  }

  const { idempotencyRows, requestRows, sessionRows } =
    parseAgenticActionHealthRpcPayload(healthResult.data);
  let inProgressCount = 0;
  let staleInProgressCount = 0;
  let completeTerminalErrorCount = 0;
  let terminalErrorCount = 0;
  const nowMs = Date.now();
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
    } else if (row.status_code >= 500) {
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

  return {
    data: {
      actions: buildAgenticHealthActions({
        activeInProgressCount: inProgressCount - staleInProgressCount,
        allowlistCount: requestControlSummary.allowlistCount,
        completeTerminalErrorCount,
        isAgenticCheckoutEnabled:
          requestControlSummary.isAgenticCheckoutEnabled,
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
        records: sessionRows.map((row) => ({
          payment_state: getAgenticPaymentState(row.metadata),
          session_id: row.session_id,
          status: row.status,
          updated_at: row.updated_at,
        })),
      },
      generated_at: new Date().toISOString(),
      idempotency: {
        active_in_progress_count: inProgressCount - staleInProgressCount,
        in_progress_count: inProgressCount,
        recent_count: idempotencyRows.length,
        records: idempotencyRows.map((row) => ({
          created_at: row.created_at,
          expires_at: row.expires_at,
          route: row.route,
          state: getIdempotencyState(row.status_code),
          status_code: row.status_code,
          updated_at: row.updated_at,
        })),
        stale_in_progress_count: staleInProgressCount,
        terminal_error_count: terminalErrorCount,
      },
      merchant_id: merchantId,
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
          api_version: row.api_version,
          created_at: row.created_at,
          expires_at: row.expires_at,
        })),
      },
    },
    ok: true as const,
  };
}

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user || !auth.supabase) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const merchantContext = await getMerchantForApiRequest(
    auth.supabase,
    auth.user.id
  );
  if (!merchantContext) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }

  const access = toUserAccess(merchantContext);
  if (!hasPermission(access, 'dashboard', 'view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const health = await loadAgenticActionHealth(
    auth.supabase,
    merchantContext.merchantId
  );
  if (!health.ok) {
    logger.error({
      message: 'Failed to load agentic action health',
      error: sanitizeForLog(health.error),
      merchantId: merchantContext.merchantId,
    });
    return NextResponse.json(
      { error: 'Failed to load agentic action health' },
      { status: 500 }
    );
  }

  return NextResponse.json(health.data);
}
