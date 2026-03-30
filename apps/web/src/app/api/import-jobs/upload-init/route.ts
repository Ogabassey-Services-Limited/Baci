import { type NextRequest, NextResponse } from 'next/server';
import { isImportJobDirectUploadEnabled } from '@/env';
import { checkCsrfProtection } from '@/lib/csrf';
import { PENDING_IMPORT_UPLOAD_SELECT } from '@/lib/import-jobs/import-job-columns';
import { resolveImportRouteContext } from '@/lib/import-jobs/import-job-route-auth';
import {
  createImportStoragePath,
  validateImportFileMetadata,
} from '@/lib/import-jobs/import-job-service';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limiter';
import { importJobUploadInitSchema } from '@/schemas/import-jobs';

const PENDING_UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;

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

    const parsedInput = importJobUploadInitSchema.safeParse(
      await request.json()
    );
    if (!parsedInput.success) {
      return NextResponse.json(
        { error: 'Invalid import job payload', code: 'invalid_input' },
        { status: 400 }
      );
    }

    const fileError = validateImportFileMetadata(parsedInput.data);
    if (fileError) {
      return NextResponse.json(
        { error: fileError, code: 'invalid_file' },
        { status: 400 }
      );
    }

    const storagePath = createImportStoragePath(
      authResult.context.merchantContext.merchantId,
      parsedInput.data.entityType,
      parsedInput.data.fileName
    );
    const clientUploadId = crypto.randomUUID();
    const { data: signedUpload, error: signedUploadError } =
      await authResult.context.supabase.storage
        .from('migration-imports')
        .createSignedUploadUrl(storagePath, {
          upsert: false,
        });

    if (signedUploadError || !signedUpload) {
      logger.error({
        message: 'Failed to create migration import signed upload URL',
        error: signedUploadError,
        merchantId: authResult.context.merchantContext.merchantId,
        storagePath,
      });
      return NextResponse.json(
        {
          error: 'Failed to initialize direct upload',
          code: 'upload_init_failed',
        },
        { status: 500 }
      );
    }

    const expiresAt = new Date(
      Date.now() + PENDING_UPLOAD_TTL_MS
    ).toISOString();
    const { error: pendingUploadError } = await authResult.context.supabase
      .from('pending_import_uploads')
      .insert({
        merchant_id: authResult.context.merchantContext.merchantId,
        created_by: authResult.context.userId,
        client_upload_id: clientUploadId,
        storage_path: storagePath,
        source_platform: parsedInput.data.sourcePlatform,
        entity_type: parsedInput.data.entityType,
        original_filename: parsedInput.data.fileName,
        content_type: parsedInput.data.contentType || 'text/csv',
        file_size_bytes: parsedInput.data.fileSizeBytes,
        expires_at: expiresAt,
      })
      .select(PENDING_IMPORT_UPLOAD_SELECT)
      .single();

    if (pendingUploadError) {
      logger.error({
        message: 'Failed to create pending import upload record',
        error: pendingUploadError,
        merchantId: authResult.context.merchantContext.merchantId,
        clientUploadId,
      });
      return NextResponse.json(
        {
          error: 'Failed to initialize direct upload',
          code: 'upload_init_failed',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      upload: {
        clientUploadId,
        expiresAt,
        storagePath,
        uploadToken: signedUpload.token,
      },
    });
  } catch (error) {
    logger.error({
      message: 'Import upload-init route failed',
      error,
    });
    return NextResponse.json(
      { error: 'Internal server error', code: 'internal_error' },
      { status: 500 }
    );
  }
}
