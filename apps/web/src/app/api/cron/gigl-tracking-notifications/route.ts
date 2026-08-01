import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasValidCronSecret } from '@/lib/cron-secret-auth';
import { logger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';
import { createCronBatchSizeSchema } from '@/schemas/cron-batch-size';
import {
  claimedGiglTrackingNotificationsSchema,
  processClaimedGiglTrackingNotifications,
} from '../gigl-tracking/gigl-tracking-notification-worker';

export const maxDuration = 60;
const MAX_NOTIFICATION_BATCH_SIZE = 10;
const batchSizeSchema = createCronBatchSizeSchema({
  defaultSize: MAX_NOTIFICATION_BATCH_SIZE,
  maxSize: MAX_NOTIFICATION_BATCH_SIZE,
});

export async function GET(request: Request) {
  if (!hasValidCronSecret(request.headers, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const batchSize = batchSizeSchema.safeParse(
    new URL(request.url).searchParams.get('batchSize')
  );
  if (!batchSize.success)
    return NextResponse.json({ error: 'Invalid batch size' }, { status: 400 });

  const supabase = createServiceClient('event-pipeline');
  const workerId = `gigl-notifications-${crypto.randomUUID()}`;
  const { data, error } = await supabase.rpc(
    'claim_shipment_tracking_notifications',
    {
      p_limit: batchSize.data,
      p_worker_id: workerId,
    }
  );
  if (error) {
    logger.error({
      message: 'Failed to claim GIGL tracking notifications',
      error,
    });
    return NextResponse.json(
      { error: 'Failed to claim GIGL tracking notifications' },
      { status: 500 }
    );
  }
  const notifications = claimedGiglTrackingNotificationsSchema.safeParse(
    data ?? []
  );
  if (!notifications.success) {
    logger.error({
      message: 'Invalid GIGL tracking notification claim payload',
      error: z.flattenError(notifications.error),
    });
    return NextResponse.json(
      { error: 'Invalid GIGL tracking notification payload' },
      { status: 500 }
    );
  }
  try {
    return NextResponse.json(
      await processClaimedGiglTrackingNotifications(
        supabase,
        notifications.data,
        workerId
      )
    );
  } catch (error) {
    logger.error({
      message: 'GIGL tracking notification worker failed',
      error,
    });
    return NextResponse.json(
      { error: 'Failed to process GIGL tracking notifications' },
      { status: 500 }
    );
  }
}
