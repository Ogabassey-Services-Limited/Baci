import { unstable_noStore as noStore } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import {
  getImportJobForMerchant,
  hasImportRoutePermission,
  resolveImportRouteContext,
} from '@/lib/import-jobs/import-job-route-auth';
import { logger } from '@/lib/logger';
import { importJobParamsSchema } from '@/schemas/import-jobs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    noStore();

    const authResult = await resolveImportRouteContext(request);
    if (!authResult.context) {
      return (
        authResult.response ??
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      );
    }

    const parsedParams = importJobParamsSchema.safeParse(await params);
    if (!parsedParams.success) {
      return NextResponse.json(
        { error: 'Invalid import job id', code: 'invalid_job_id' },
        { status: 400 }
      );
    }

    const job = await getImportJobForMerchant(
      authResult.context.supabase,
      authResult.context.merchantContext.merchantId,
      parsedParams.data.jobId
    );

    if (!job) {
      return NextResponse.json(
        { error: 'Import job not found', code: 'not_found' },
        { status: 404 }
      );
    }

    if (
      !hasImportRoutePermission(
        authResult.context.merchantContext,
        job.entity_type
      )
    ) {
      return NextResponse.json(
        { error: 'Forbidden', code: 'forbidden' },
        { status: 403 }
      );
    }

    const summary = (job.summary || {}) as Record<string, unknown>;
    const validRows =
      typeof summary.validRows === 'number' ? summary.validRows : 0;

    return NextResponse.json({
      job: {
        ...job,
        canCommit: job.status === 'preview_ready' && validRows > 0,
        canNotify:
          job.entity_type === 'orders' &&
          job.status === 'committed' &&
          validRows > 0,
      },
    });
  } catch (error) {
    logger.error({
      message: 'Import job detail route failed',
      error,
    });
    return NextResponse.json(
      { error: 'Internal server error', code: 'internal_error' },
      { status: 500 }
    );
  }
}
