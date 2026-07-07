import { NextResponse } from 'next/server';
import { getCronSecret } from '@/env';
import { hasValidCronSecret } from '@/lib/cron-secret-auth';
import { logger } from '@/lib/logger';
import {
  type OrderFulfillmentNotificationEventType,
  sendOrderFulfillmentNotification,
} from '@/lib/order-fulfillment-notification';
import { createServiceClient } from '@/lib/supabase/service';

export const maxDuration = 60;

const DEFAULT_BATCH_SIZE = 1;
const MAX_BATCH_SIZE = 10;
const RETRY_BASE_DELAY_MS = 5 * 60 * 1000;
const RETRY_MAX_DELAY_MS = 60 * 60 * 1000;
const PROCESS_CONCURRENCY = 5;

type ClaimedOrderNotificationOutboxRow = {
  attempt_count: number;
  event_type: OrderFulfillmentNotificationEventType;
  id: string;
  max_attempts: number;
  merchant_id: string;
  order_id: string;
};

type OrderNotificationOutboxStatus = 'pending' | 'sent' | 'skipped' | 'failed';

type SupabaseClientLike = ReturnType<typeof createServiceClient>;

interface CronSummary {
  claimed: number;
  failed: number;
  retried: number;
  sent: number;
  skipped: number;
  success: true;
}

function clampBatchSize(value: string | null): number {
  if (!value) return DEFAULT_BATCH_SIZE;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_BATCH_SIZE;
  return Math.min(Math.max(parsed, 1), MAX_BATCH_SIZE);
}

function retryDelayMs(attemptCount: number): number {
  const exponent = Math.max(0, attemptCount - 1);
  return Math.min(RETRY_BASE_DELAY_MS * 2 ** exponent, RETRY_MAX_DELAY_MS);
}

async function updateOutboxStatus(
  supabase: SupabaseClientLike,
  id: string,
  values: Record<string, unknown>
) {
  const { error } = await supabase
    .from('order_notification_outbox')
    .update({
      ...values,
      locked_at: null,
      locked_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    logger.error({
      message: 'Failed to update order notification outbox row',
      outboxId: id,
      error,
    });
  }
}

async function markSent(
  supabase: SupabaseClientLike,
  row: ClaimedOrderNotificationOutboxRow,
  messageId: string | undefined
) {
  await updateOutboxStatus(supabase, row.id, {
    last_error: null,
    metadata: messageId ? { message_id: messageId } : {},
    sent_at: new Date().toISOString(),
    status: 'sent' satisfies OrderNotificationOutboxStatus,
  });
}

async function markSkipped(
  supabase: SupabaseClientLike,
  row: ClaimedOrderNotificationOutboxRow,
  reason: string
) {
  await updateOutboxStatus(supabase, row.id, {
    last_error: null,
    skip_reason: reason,
    skipped_at: new Date().toISOString(),
    status: 'skipped' satisfies OrderNotificationOutboxStatus,
  });
}

async function markFailedOrRetry(
  supabase: SupabaseClientLike,
  row: ClaimedOrderNotificationOutboxRow,
  error: string,
  summary: CronSummary
) {
  if (row.attempt_count >= row.max_attempts) {
    summary.failed += 1;
    await updateOutboxStatus(supabase, row.id, {
      last_error: error,
      next_attempt_at: null,
      status: 'failed' satisfies OrderNotificationOutboxStatus,
    });
    return;
  }

  summary.retried += 1;
  await updateOutboxStatus(supabase, row.id, {
    last_error: error,
    next_attempt_at: new Date(
      Date.now() + retryDelayMs(row.attempt_count)
    ).toISOString(),
    status: 'pending' satisfies OrderNotificationOutboxStatus,
  });
}

async function processClaimedRow(
  supabase: SupabaseClientLike,
  row: ClaimedOrderNotificationOutboxRow,
  summary: CronSummary
) {
  try {
    const result = await sendOrderFulfillmentNotification({
      eventType: row.event_type,
      merchantId: row.merchant_id,
      orderId: row.order_id,
      supabase,
    });

    if (result.status === 'sent') {
      summary.sent += 1;
      await markSent(supabase, row, result.messageId);
      return;
    }

    if (result.status === 'skipped') {
      summary.skipped += 1;
      await markSkipped(supabase, row, result.reason);
      return;
    }

    await markFailedOrRetry(supabase, row, result.error, summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    logger.error({
      message: 'Unhandled order notification outbox processing failure',
      outboxId: row.id,
      orderId: row.order_id,
      error,
    });
    await markFailedOrRetry(supabase, row, message, summary);
  }
}

function groupRowsByOrderId(rows: ClaimedOrderNotificationOutboxRow[]) {
  const groups: ClaimedOrderNotificationOutboxRow[][] = [];
  const groupIndexesByOrderId = new Map<string, number>();

  for (const row of rows) {
    const existingIndex = groupIndexesByOrderId.get(row.order_id);
    if (existingIndex !== undefined) {
      groups[existingIndex]?.push(row);
      continue;
    }

    groupIndexesByOrderId.set(row.order_id, groups.length);
    groups.push([row]);
  }

  return groups;
}

async function processClaimedRows(
  supabase: SupabaseClientLike,
  rows: ClaimedOrderNotificationOutboxRow[],
  summary: CronSummary
) {
  const groups = groupRowsByOrderId(rows);
  let nextGroupIndex = 0;
  const workerCount = Math.min(PROCESS_CONCURRENCY, groups.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextGroupIndex < groups.length) {
        const group = groups[nextGroupIndex];
        nextGroupIndex += 1;

        for (const row of group ?? []) {
          await processClaimedRow(supabase, row, summary);
        }
      }
    })
  );
}

/**
 * GET /api/cron/order-notifications
 *
 * Scheduled execution lives in vps-workers; keep CRON_SECRET gating intact.
 * Claims and drains transactional outbox rows created when order fulfillment
 * status transitions happen, so email provider failures cannot roll back or
 * block the order status update path.
 */
export async function GET(request: Request) {
  if (!hasValidCronSecret(request.headers, getCronSecret())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const batchSize = clampBatchSize(url.searchParams.get('batchSize'));
  const supabase = createServiceClient();
  const workerId = `web-cron-${Date.now()}`;

  const { data, error } = await supabase.rpc(
    'claim_order_notification_outbox',
    {
      p_batch_size: batchSize,
      p_worker_id: workerId,
    }
  );

  if (error) {
    logger.error({
      message: 'Failed to claim order notification outbox rows',
      error,
    });
    return NextResponse.json(
      { error: 'Failed to claim order notifications' },
      { status: 500 }
    );
  }

  const rows = (data ?? []) as ClaimedOrderNotificationOutboxRow[];
  const summary: CronSummary = {
    claimed: rows.length,
    failed: 0,
    retried: 0,
    sent: 0,
    skipped: 0,
    success: true,
  };

  await processClaimedRows(supabase, rows, summary);

  return NextResponse.json(summary);
}
