import { after, type NextRequest, NextResponse } from 'next/server';
import { checkCsrfProtection } from '@/lib/csrf';
import { IMPORT_JOB_SELECT } from '@/lib/import-jobs/import-job-columns';
import {
  hasImportRoutePermission,
  resolveImportRouteContext,
} from '@/lib/import-jobs/import-job-route-auth';
import {
  createImportStoragePath,
  type ImportJobRecord,
  validateImportFile,
} from '@/lib/import-jobs/import-job-service';
import { kickoffImportJob } from '@/lib/import-jobs/kickoff-import-job';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limiter';
import { importJobUploadSchema } from '@/schemas/import-jobs';

export async function POST(request: NextRequest) {
  try {
    const authResult = await resolveImportRouteContext(request);
    if (!authResult.context) {
      return (
        authResult.response ??
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    const formData = await request.formData();
    const parsedInput = importJobUploadSchema.safeParse({
      sourcePlatform:
        typeof formData.get('sourcePlatform') === 'string'
          ? formData.get('sourcePlatform')
          : undefined,
      entityType:
        typeof formData.get('entityType') === 'string'
          ? formData.get('entityType')
          : undefined,
    });

    if (!parsedInput.success) {
      return NextResponse.json(
        { error: 'Invalid import job payload', code: 'invalid_input' },
        { status: 400 }
      );
    }

    if (
      !hasImportRoutePermission(
        authResult.context.merchantContext,
        parsedInput.data.entityType
      )
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'CSV file is required', code: 'missing_file' },
        { status: 400 }
      );
    }

    const fileError = validateImportFile(file);
    if (fileError) {
      return NextResponse.json(
        { error: fileError, code: 'invalid_file' },
        { status: 400 }
      );
    }

    const storagePath = createImportStoragePath(
      authResult.context.merchantContext.merchantId,
      parsedInput.data.entityType,
      file.name
    );
    const uploadBuffer = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await authResult.context.supabase.storage
      .from('migration-imports')
      .upload(storagePath, uploadBuffer, {
        contentType: file.type || 'text/csv',
        upsert: false,
      });

    if (uploadError) {
      logger.error({
        message: 'Failed to upload migration import file',
        error: uploadError,
        merchantId: authResult.context.merchantContext.merchantId,
      });
      return NextResponse.json(
        { error: 'Failed to upload CSV file', code: 'upload_failed' },
        { status: 500 }
      );
    }

    const { data: job, error: insertError } = await authResult.context.supabase
      .from('import_jobs')
      .insert({
        merchant_id: authResult.context.merchantContext.merchantId,
        created_by: authResult.context.userId,
        source_platform: parsedInput.data.sourcePlatform,
        entity_type: parsedInput.data.entityType,
        status: 'uploaded',
        original_filename: file.name,
        storage_path: storagePath,
        content_type: file.type || 'text/csv',
        file_size_bytes: file.size,
      })
      .select(IMPORT_JOB_SELECT)
      .single();

    if (insertError || !job) {
      const { error: cleanupError } = await authResult.context.supabase.storage
        .from('migration-imports')
        .remove([storagePath]);
      if (cleanupError) {
        logger.error({
          message: 'Failed to clean up uploaded migration import file',
          error: cleanupError,
          storagePath,
          merchantId: authResult.context.merchantContext.merchantId,
        });
      }
      logger.error({
        message: 'Failed to create import job',
        error: insertError,
        merchantId: authResult.context.merchantContext.merchantId,
      });
      return NextResponse.json(
        { error: 'Failed to create import job', code: 'job_create_failed' },
        { status: 500 }
      );
    }

    const createdJob = job as unknown as ImportJobRecord;

    const origin = request.nextUrl.origin;
    after(async () => {
      try {
        await kickoffImportJob(createdJob.id, origin);
      } catch (err) {
        logger.error({
          message: 'Background kickoff failed',
          jobId: createdJob.id,
          origin,
          error: err,
        });
      }
    });

    return NextResponse.json({ job: createdJob }, { status: 202 });
  } catch (error) {
    logger.error({
      message: 'Import job upload route failed',
      error,
    });
    return NextResponse.json(
      { error: 'Internal server error', code: 'internal_error' },
      { status: 500 }
    );
  }
}
