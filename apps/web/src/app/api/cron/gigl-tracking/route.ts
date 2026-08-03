import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasValidCronSecret } from '@/lib/cron-secret-auth';
import { logger } from '@/lib/logger';
import { isGiglRuntimeConfigured } from '@/lib/shipping/providers/gigl.constants';
import { createServiceClient } from '@/lib/supabase/service';
import { createCronBatchSizeSchema } from '@/schemas/cron-batch-size';
import type { Database } from '@/types/supabase';
import {
  claimedGiglTrackingMonitorsSchema,
  processClaimedGiglTrackingMonitors,
} from './gigl-tracking-monitor-worker';

export const maxDuration = 60;

const batchSizeSchema = createCronBatchSizeSchema({
  defaultSize: 25,
  maxSize: 50,
});

export async function GET(request: Request) {
  if (!hasValidCronSecret(request.headers, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsedBatchSize = batchSizeSchema.safeParse(
    new URL(request.url).searchParams.get('batchSize')
  );
  if (!parsedBatchSize.success) {
    return NextResponse.json({ error: 'Invalid batch size' }, { status: 400 });
  }

  if (!isGiglRuntimeConfigured()) {
    return NextResponse.json({
      applied: 0,
      claimed: 0,
      failed: 0,
      paused: 0,
      success: true,
    });
  }

  const supabase = createServiceClient(
    'event-pipeline'
  ) as unknown as SupabaseClient<Database>;
  const workerId = `gigl-tracking-${crypto.randomUUID()}`;
  const { data, error } = await supabase.rpc(
    'claim_due_gigl_tracking_monitors',
    {
      p_limit: parsedBatchSize.data,
      p_worker_id: workerId,
    }
  );
  if (error) {
    logger.error({ message: 'Failed to claim GIGL tracking monitors', error });
    return NextResponse.json(
      { error: 'Failed to claim GIGL tracking monitors' },
      { status: 500 }
    );
  }

  const parsedMonitors = claimedGiglTrackingMonitorsSchema.safeParse(
    data ?? []
  );
  if (!parsedMonitors.success) {
    logger.error({
      message: 'Invalid GIGL tracking monitor claim payload',
      error: z.flattenError(parsedMonitors.error),
    });
    return NextResponse.json(
      { error: 'Invalid GIGL tracking monitor payload' },
      { status: 500 }
    );
  }

  try {
    const summary = await processClaimedGiglTrackingMonitors(
      supabase,
      parsedMonitors.data,
      workerId
    );
    return NextResponse.json(summary);
  } catch (error) {
    logger.error({ message: 'GIGL tracking worker failed', error });
    return NextResponse.json(
      { error: 'Failed to process GIGL tracking monitors' },
      { status: 500 }
    );
  }
}
