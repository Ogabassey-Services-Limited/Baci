import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCronSecret, getImportJobWorkerBatchSize } from '@/env';
import { processImportJobQueue } from '@/lib/import-jobs/process-import-job';
import { logger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';

function hasValidCronSecret(request: Request) {
  const expectedSecret = getCronSecret();
  if (!expectedSecret) {
    return false;
  }

  const authorization = request.headers.get('authorization');
  const bearerToken = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null;
  const legacyHeader = request.headers.get('x-cron-secret');
  const candidateSecret = bearerToken || legacyHeader;

  if (!candidateSecret || candidateSecret.length !== expectedSecret.length) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(candidateSecret),
    Buffer.from(expectedSecret)
  );
}

async function handleCronRequest(request: Request) {
  try {
    if (!hasValidCronSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = await processImportJobQueue(
      createServiceClient(),
      getImportJobWorkerBatchSize()
    );

    return NextResponse.json({
      processed: results.length,
      results,
    });
  } catch (error) {
    logger.error({
      message: 'Process import jobs cron failed',
      error,
    });
    return NextResponse.json(
      { error: 'Internal server error', code: 'internal_error' },
      { status: 500 }
    );
  }
}

export function GET(request: Request) {
  return handleCronRequest(request);
}

export function POST(request: Request) {
  return handleCronRequest(request);
}
