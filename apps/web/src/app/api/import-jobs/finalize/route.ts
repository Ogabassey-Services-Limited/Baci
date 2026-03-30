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
import type { ImportJobRecord } from '@/lib/import-jobs/import-job-service';
import { kickoffImportJob } from '@/lib/import-jobs/kickoff-import-job';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limiter';
import { importJobFinalizeSchema } from '@/schemas/import-jobs';

type PendingUploadRecord = {
  claimed_at: string | null;
  client_upload_id: string;
  content_type: string | null;
  entity_type: 'orders' | 'products';
  expires_at: string;
  file_size_bytes: number | null;
  merchant_id: string;
  original_filename: string;
  source_platform: 'bumpa';
  storage_path: string;
};

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

    if (!isImportJobDirectUploadEnabled()) {
      return NextResponse.json(
        { error: 'Direct upload is disabled', code: 'direct_upload_disabled' },
        { status: 409 }
      );
    }

    const isAllowed = await checkRateLimit(
      authResult.context.supabase,
      authResult.context.userId,
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

    const parsedInput = importJobFinalizeSchema.safeParse(await request.json());
    if (!parsedInput.success) {
      return NextResponse.json(
        { error: 'Invalid import job payload', code: 'invalid_input' },
        { status: 400 }
      );
    }

    const existingJobResult = await authResult.context.supabase
      .from('import_jobs')
      .select(IMPORT_JOB_SELECT)
      .eq('merchant_id', authResult.context.merchantContext.merchantId)
      .eq('client_upload_id', parsedInput.data.clientUploadId)
      .maybeSingle();

    if (existingJobResult.error) {
      throw new Error(existingJobResult.error.message);
    }

    if (existingJobResult.data) {
      return NextResponse.json(
        { job: existingJobResult.data },
        { status: 202 }
      );
    }

    const pendingUploadResult = await authResult.context.supabase
      .from('pending_import_uploads')
      .select(PENDING_IMPORT_UPLOAD_SELECT)
      .eq('merchant_id', authResult.context.merchantContext.merchantId)
      .eq('client_upload_id', parsedInput.data.clientUploadId)
      .maybeSingle();

    if (pendingUploadResult.error) {
      throw new Error(pendingUploadResult.error.message);
    }

    const pendingUpload =
      pendingUploadResult.data as PendingUploadRecord | null;
    if (!pendingUpload) {
      return NextResponse.json(
        { error: 'Pending upload not found', code: 'pending_upload_not_found' },
        { status: 404 }
      );
    }

    if (
      !hasImportRoutePermission(
        authResult.context.merchantContext,
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

    const storageCheck = await authResult.context.supabase.storage
      .from('migration-imports')
      .exists(pendingUpload.storage_path);
    if (storageCheck.error) {
      throw new Error(storageCheck.error.message);
    }
    if (!storageCheck.data) {
      return NextResponse.json(
        { error: 'Uploaded file is missing', code: 'upload_missing' },
        { status: 409 }
      );
    }

    const insertResult = await authResult.context.supabase
      .from('import_jobs')
      .insert({
        merchant_id: authResult.context.merchantContext.merchantId,
        created_by: authResult.context.userId,
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
      .single();

    if (insertResult.error || !insertResult.data) {
      const retryLookup = await authResult.context.supabase
        .from('import_jobs')
        .select(IMPORT_JOB_SELECT)
        .eq('merchant_id', authResult.context.merchantContext.merchantId)
        .eq('client_upload_id', parsedInput.data.clientUploadId)
        .maybeSingle();

      if (retryLookup.error) {
        throw new Error(retryLookup.error.message);
      }

      if (retryLookup.data) {
        return NextResponse.json({ job: retryLookup.data }, { status: 202 });
      }

      throw new Error(
        insertResult.error?.message || 'Failed to create import job'
      );
    }

    const createdJob = insertResult.data as unknown as ImportJobRecord;

    const claimResult = await authResult.context.supabase
      .from('pending_import_uploads')
      .update({
        claimed_at: new Date().toISOString(),
      })
      .eq('merchant_id', authResult.context.merchantContext.merchantId)
      .eq('client_upload_id', parsedInput.data.clientUploadId)
      .single();

    if (claimResult.error) {
      logger.error({
        message: 'Failed to mark pending import upload as claimed',
        error: claimResult.error,
        clientUploadId: parsedInput.data.clientUploadId,
      });
    }

    const origin = request.nextUrl.origin;
    after(async () => {
      try {
        await kickoffImportJob(createdJob.id, origin);
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
