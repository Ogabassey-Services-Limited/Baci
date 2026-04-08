import { after, type NextRequest, NextResponse } from 'next/server';
import { isImportJobDirectUploadEnabled } from '@/env';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  IMPORT_JOB_SELECT,
  PENDING_IMPORT_UPLOAD_SELECT,
} from '@/lib/import-jobs/import-job-columns';
import {
  hasImportRoutePermission,
  resolveImportRouteContext,
} from '@/lib/import-jobs/import-job-route-auth';
import {
  type ImportJobRecord,
  type PendingImportUploadRecord,
} from '@/lib/import-jobs/import-job-service';
import { startImportJob } from '@/lib/import-jobs/kickoff-import-job';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limiter';
import { importJobFinalizeSchema } from '@/schemas/import-jobs';

function isExpired(expiresAt: string) {
  return new Date(expiresAt).getTime() <= Date.now();
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await resolveImportRouteContext(request);
    if (!authResult.context) {
      return (
        authResult.response ??
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      );
    }
    const { context } = authResult;

    if (!isImportJobDirectUploadEnabled()) {
      return NextResponse.json(
        { error: 'Direct upload is disabled', code: 'direct_upload_disabled' },
        { status: 409 }
      );
    }

    const isAllowed = await checkRateLimit(
      context.supabase,
      context.userId,
      'import_jobs',
      10,
      1
    );
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', code: 'rate_limited' },
        { status: 429 }
      );
    }

    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) {
      return (
        response ??
        NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid import job payload', code: 'invalid_input' },
        { status: 400 }
      );
    }

    const parsedInput = importJobFinalizeSchema.safeParse(rawBody);
    if (!parsedInput.success) {
      return NextResponse.json(
        { error: 'Invalid import job payload', code: 'invalid_input' },
        { status: 400 }
      );
    }

    const existingJobResult = await context.supabase
      .from('import_jobs')
      .select(IMPORT_JOB_SELECT)
      .eq('merchant_id', context.merchantContext.merchantId)
      .eq('client_upload_id', parsedInput.data.clientUploadId)
      .maybeSingle<ImportJobRecord>();

    if (existingJobResult.error) {
      throw new Error(existingJobResult.error.message);
    }

    if (existingJobResult.data) {
      return NextResponse.json(
        { job: existingJobResult.data },
        { status: 202 }
      );
    }

    const pendingUploadResult = await context.supabase
      .from('pending_import_uploads')
      .select(PENDING_IMPORT_UPLOAD_SELECT)
      .eq('merchant_id', context.merchantContext.merchantId)
      .eq('client_upload_id', parsedInput.data.clientUploadId)
      .maybeSingle<PendingImportUploadRecord>();

    if (pendingUploadResult.error) {
      throw new Error(pendingUploadResult.error.message);
    }

    const pendingUpload = pendingUploadResult.data;
    if (!pendingUpload) {
      return NextResponse.json(
        { error: 'Pending upload not found', code: 'pending_upload_not_found' },
        { status: 404 }
      );
    }

    if (
      !hasImportRoutePermission(
        context.merchantContext,
        pendingUpload.entity_type
      )
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (pendingUpload.claimed_at) {
      return NextResponse.json(
        {
          error: 'Pending upload has already been claimed',
          code: 'upload_claimed',
        },
        { status: 409 }
      );
    }

    if (isExpired(pendingUpload.expires_at)) {
      return NextResponse.json(
        { error: 'Pending upload has expired', code: 'upload_expired' },
        { status: 410 }
      );
    }

    const claimedAt = new Date().toISOString();
    const claimResult = await context.supabase
      .from('pending_import_uploads')
      .update({
        claimed_at: claimedAt,
      })
      .eq('merchant_id', context.merchantContext.merchantId)
      .eq('client_upload_id', parsedInput.data.clientUploadId)
      .is('claimed_at', null)
      .gt('expires_at', new Date().toISOString())
      .select('id, claimed_at')
      .maybeSingle();

    if (claimResult.error) {
      throw new Error(claimResult.error.message);
    }

    if (!claimResult.data) {
      const racedJobResult = await context.supabase
        .from('import_jobs')
        .select(IMPORT_JOB_SELECT)
        .eq('merchant_id', context.merchantContext.merchantId)
        .eq('client_upload_id', parsedInput.data.clientUploadId)
        .maybeSingle<ImportJobRecord>();

      if (racedJobResult.error) {
        throw new Error(racedJobResult.error.message);
      }

      if (racedJobResult.data) {
        return NextResponse.json({ job: racedJobResult.data }, { status: 202 });
      }

      return NextResponse.json(
        {
          error: 'Pending upload has already been claimed',
          code: 'upload_claimed',
        },
        { status: 409 }
      );
    }

    const releaseClaim = async () => {
      const releaseResult = await context.supabase
        .from('pending_import_uploads')
        .update({ claimed_at: null })
        .eq('merchant_id', context.merchantContext.merchantId)
        .eq('client_upload_id', parsedInput.data.clientUploadId)
        .eq('claimed_at', claimedAt);

      if (releaseResult.error) {
        logger.error({
          message: 'Failed to release pending import upload claim',
          error: releaseResult.error,
          clientUploadId: parsedInput.data.clientUploadId,
        });
      }
    };

    const storageCheck = await context.supabase.storage
      .from('migration-imports')
      .exists(pendingUpload.storage_path);
    if (storageCheck.error) {
      await releaseClaim();
      throw new Error(storageCheck.error.message);
    }
    if (!storageCheck.data) {
      await releaseClaim();
      return NextResponse.json(
        { error: 'Uploaded file is missing', code: 'upload_missing' },
        { status: 409 }
      );
    }

    const insertResult = await context.supabase
      .from('import_jobs')
      .insert({
        merchant_id: context.merchantContext.merchantId,
        created_by: context.userId,
        client_upload_id: pendingUpload.client_upload_id,
        source_platform: pendingUpload.source_platform,
        entity_type: pendingUpload.entity_type,
        status: 'uploaded',
        original_filename: pendingUpload.original_filename,
        storage_path: pendingUpload.storage_path,
        content_type: pendingUpload.content_type || 'text/csv',
        file_size_bytes: pendingUpload.file_size_bytes,
      })
      .select(IMPORT_JOB_SELECT)
      .single<ImportJobRecord>();

    if (insertResult.error || !insertResult.data) {
      const retryLookup = await context.supabase
        .from('import_jobs')
        .select(IMPORT_JOB_SELECT)
        .eq('merchant_id', context.merchantContext.merchantId)
        .eq('client_upload_id', parsedInput.data.clientUploadId)
        .maybeSingle<ImportJobRecord>();

      if (retryLookup.error) {
        await releaseClaim();
        throw new Error(retryLookup.error.message);
      }

      if (retryLookup.data) {
        return NextResponse.json({ job: retryLookup.data }, { status: 202 });
      }

      await releaseClaim();
      throw new Error(
        insertResult.error?.message || 'Failed to create import job'
      );
    }

    const createdJob = insertResult.data;

    const origin = request.nextUrl.origin;
    after(async () => {
      try {
        await startImportJob(createdJob.id, origin);
      } catch (error) {
        logger.error({
          message: 'Background kickoff failed',
          error,
          jobId: createdJob.id,
          origin,
        });
      }
    });

    return NextResponse.json({ job: createdJob }, { status: 202 });
  } catch (error) {
    logger.error({
      message: 'Import finalize route failed',
      error,
    });
    return NextResponse.json(
      { error: 'Internal server error', code: 'internal_error' },
      { status: 500 }
    );
  }
}
