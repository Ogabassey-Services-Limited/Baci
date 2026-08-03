import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCronSecret } from '@/env';
import { hasValidCronSecret } from '@/lib/cron-secret-auth';
import { logger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';
import { createCronBatchSizeSchema } from '@/schemas/cron-batch-size';
import {
  claimedOrderNotificationOutboxRowSchema,
  createOrderNotificationCronSummary,
  processClaimedOrderNotificationRows,
} from './order-notification-outbox-worker';

export const maxDuration = 60;
const DEFAULT_BATCH_SIZE = 1;
const MAX_BATCH_SIZE = 10;
const batchSizeSchema = createCronBatchSizeSchema({
  defaultSize: DEFAULT_BATCH_SIZE,
  maxSize: MAX_BATCH_SIZE,
});
const claimedRowsSchema = z.array(claimedOrderNotificationOutboxRowSchema);

export async function GET(request: Request) {
  if (!hasValidCronSecret(request.headers, getCronSecret())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsedBatchSize = batchSizeSchema.safeParse(
    url.searchParams.get('batchSize')
  );
  if (!parsedBatchSize.success) {
    return NextResponse.json({ error: 'Invalid batch size' }, { status: 400 });
  }
  const batchSize = parsedBatchSize.data;
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

  const parsedRows = claimedRowsSchema.safeParse(data ?? []);
  if (!parsedRows.success) {
    logger.error({
      message: 'Invalid claimed order notification outbox payload',
      error: z.flattenError(parsedRows.error),
    });
    return NextResponse.json(
      { error: 'Invalid claimed order notification payload' },
      { status: 500 }
    );
  }

  const rows = parsedRows.data;
  const summary = createOrderNotificationCronSummary(rows.length);
  try {
    await processClaimedOrderNotificationRows(supabase, rows, summary);
  } catch (error) {
    logger.error({
      message: 'Failed to persist order notification outcome',
      error,
    });
    return NextResponse.json(
      { error: 'Failed to persist order notification outcome' },
      { status: 500 }
    );
  }
  return NextResponse.json(summary);
}
