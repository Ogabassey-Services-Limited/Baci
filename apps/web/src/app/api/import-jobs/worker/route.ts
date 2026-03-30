import { type NextRequest, NextResponse } from 'next/server';
import { getImportJobWorkerBatchSize, getImportJobWorkerSecret } from '@/env';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import {
  processImportJobById,
  processImportJobQueue,
} from '@/lib/import-jobs/process-import-job';
import { logger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';
import {
  type ImportJobWorkerRequest,
  importJobWorkerRequestSchema,
} from '@/schemas/import-jobs';

function hasValidWorkerSecret(
  authHeader: string | null,
  expectedSecret: string | undefined
) {
  if (!authHeader || !expectedSecret || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const receivedSecret = authHeader.slice('Bearer '.length);
  return constantTimeEqual(receivedSecret, expectedSecret);
}

export async function POST(request: NextRequest) {
  try {
    const expectedSecret = getImportJobWorkerSecret();
    const authHeader = request.headers.get('authorization');

    if (!expectedSecret) {
      return NextResponse.json(
        { error: 'Import worker secret is not configured' },
        { status: 500 }
      );
    }

    if (!hasValidWorkerSecret(authHeader, expectedSecret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let workerRequest: ImportJobWorkerRequest = {};
    const rawBody = await request.text();

    if (rawBody.length > 0) {
      try {
        workerRequest = importJobWorkerRequestSchema.parse(JSON.parse(rawBody));
      } catch {
        return NextResponse.json(
          { error: 'Invalid worker request body', code: 'invalid_request' },
          { status: 400 }
        );
      }
    }

    const supabase = createServiceClient();
    const targetedResult = workerRequest.jobId
      ? await processImportJobById(supabase, workerRequest.jobId)
      : null;
    const results = workerRequest.jobId
      ? targetedResult
        ? [targetedResult]
        : []
      : await processImportJobQueue(supabase, getImportJobWorkerBatchSize());

    return NextResponse.json({
      processed: results.length,
      results,
    });
  } catch (error) {
    logger.error({
      message: 'Import worker route failed',
      error,
    });
    return NextResponse.json(
      { error: 'Internal server error', code: 'internal_error' },
      { status: 500 }
    );
  }
}
