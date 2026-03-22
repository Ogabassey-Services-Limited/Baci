import { type NextRequest, NextResponse } from 'next/server';
import { getImportJobWorkerBatchSize, getImportJobWorkerSecret } from '@/env';
import { processImportJobQueue } from '@/lib/import-jobs/process-import-job';
import { logger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';

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

    if (authHeader !== `Bearer ${expectedSecret}`) {
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
      message: 'Import worker route failed',
      error,
    });
    return NextResponse.json(
      { error: 'Internal server error', code: 'internal_error' },
      { status: 500 }
    );
  }
}
