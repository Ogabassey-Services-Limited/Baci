import { after, type NextRequest, NextResponse } from 'next/server';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getImportJobForMerchant,
  hasImportRoutePermission,
  resolveImportRouteContext,
} from '@/lib/import-jobs/import-job-route-auth';
import { triggerImportWorker } from '@/lib/import-jobs/import-job-service';
import { logger } from '@/lib/logger';
import { importJobParamsSchema } from '@/schemas/import-jobs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const authResult = await resolveImportRouteContext(request);
    if (!authResult.context) {
      return (
        authResult.response ??
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      );
    }

    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) {
      return (
        response ??
        NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (job.entity_type !== 'orders') {
      return NextResponse.json(
        {
          error: 'Only order imports can notify customers',
          code: 'invalid_entity',
        },
        { status: 409 }
      );
    }

    if (job.status !== 'committed') {
      return NextResponse.json(
        { error: 'Import job is not ready to notify', code: 'invalid_status' },
        { status: 409 }
      );
    }

    const { error } = await authResult.context.supabase
      .from('import_jobs')
      .update({
        status: 'notify_queued',
        error: null,
        error_details: null,
      })
      .eq('id', job.id)
      .eq('status', 'committed');

    if (error) {
      throw new Error(error.message);
    }

    after(() => triggerImportWorker(request.nextUrl.origin));

    return NextResponse.json(
      { jobId: job.id, status: 'notify_queued' },
      { status: 202 }
    );
  } catch (error) {
    logger.error({
      message: 'Import job notify route failed',
      error,
    });
    return NextResponse.json(
      { error: 'Internal server error', code: 'internal_error' },
      { status: 500 }
    );
  }
}
