import { type NextRequest, NextResponse } from 'next/server';
import { getCronSecret, getImportJobWorkerBatchSize } from '@/env';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import { checkCsrfProtection } from '@/lib/csrf';
import { processImportJobQueue } from '@/lib/import-jobs/process-import-job';
import { logger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';

// Manual fallback only - DO NOT re-enable Vercel Cron for this route.
// Scheduled execution lives in vps-workers/bin/process-import-jobs.sh; keep CRON_SECRET gating intact.
export const maxDuration = 300;

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

  if (!candidateSecret) {
    return false;
  }

  return constantTimeEqual(candidateSecret, expectedSecret);
}

function summarizeResults(results: Record<string, unknown>[]) {
  const statusCounts = results.reduce<Record<string, number>>(
    (counts, result) => {
      const status =
        typeof result.status === 'string' ? result.status : 'unknown';
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    },
    {}
  );

  return {
    processed: results.length,
    statusCounts,
  };
}

async function handleCronRequest(request: NextRequest) {
  try {
    if (!hasValidCronSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = await processImportJobQueue(
      createServiceClient(),
      getImportJobWorkerBatchSize()
    );

    return NextResponse.json(summarizeResults(results));
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

export function GET(request: NextRequest) {
  return handleCronRequest(request);
}

export async function POST(request: NextRequest) {
  const { valid, response } = await checkCsrfProtection(request);
  if (!valid) {
    return (
      response ??
      NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
    );
  }

  return handleCronRequest(request);
}
