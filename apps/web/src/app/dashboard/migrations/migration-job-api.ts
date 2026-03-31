import type {
  ImportJobDetail,
  ImportJobListItem,
  ImportJobRowsResponse,
  MigrationPreviewFilter,
} from '@/app/dashboard/migrations/migration-types';
import { buildCsrfHeaders } from '@/lib/csrf';
import { createClient } from '@/lib/supabase/client';
import type {
  ImportJobEntityType,
  ImportJobSourcePlatform,
} from '@/schemas/import-jobs';

export function mergeJobs(
  jobs: ImportJobListItem[],
  nextJob: ImportJobListItem
) {
  return [nextJob, ...jobs.filter((job) => job.id !== nextJob.id)];
}

export function buildMigrationRowsUrl(
  jobId: string,
  page: number,
  filter: MigrationPreviewFilter
) {
  const params = new URLSearchParams({
    filter,
    page: String(page),
    pageSize: '25',
  });

  return `/api/import-jobs/${jobId}/rows?${params.toString()}`;
}

export async function fetchImportJob(jobId: string) {
  const response = await fetch(`/api/import-jobs/${jobId}`, {
    cache: 'no-store',
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || 'Failed to load import job');
  }

  return payload.job as ImportJobDetail;
}

export async function fetchImportJobRows(
  jobId: string,
  page: number,
  filter: MigrationPreviewFilter
) {
  const response = await fetch(buildMigrationRowsUrl(jobId, page, filter), {
    cache: 'no-store',
  });
  const payload = (await response.json()) as
    | ImportJobRowsResponse
    | { error?: string };

  if (!response.ok) {
    throw new Error(
      ('error' in payload && payload.error) || 'Failed to load import job rows'
    );
  }

  return payload as ImportJobRowsResponse;
}

export async function createImportJob(input: {
  entityType: ImportJobEntityType;
  file: File;
  sourcePlatform: ImportJobSourcePlatform;
}): Promise<ImportJobListItem> {
  const initResponse = await fetch('/api/import-jobs/upload-init', {
    method: 'POST',
    headers: {
      ...buildCsrfHeaders(),
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sourcePlatform: input.sourcePlatform,
      entityType: input.entityType,
      fileName: input.file.name,
      fileSizeBytes: input.file.size,
      contentType: input.file.type || null,
    }),
  });
  const initPayload = await initResponse.json();

  if (!initResponse.ok) {
    if (
      initResponse.status === 404 ||
      initPayload.code === 'direct_upload_disabled'
    ) {
      const formData = new FormData();
      formData.set('sourcePlatform', input.sourcePlatform);
      formData.set('entityType', input.entityType);
      formData.set('file', input.file);

      return await createImportJobMultipart(formData);
    }

    throw new Error(initPayload.error || 'Failed to create import job');
  }

  const supabase = createClient();
  const { error: uploadError } = await supabase.storage
    .from('migration-imports')
    .uploadToSignedUrl(
      initPayload.upload.storagePath,
      initPayload.upload.uploadToken,
      input.file,
      {
        contentType: input.file.type || 'text/csv',
        upsert: false,
      }
    );

  if (uploadError) {
    throw new Error(uploadError.message || 'Failed to upload CSV file');
  }

  const finalizeResponse = await fetch('/api/import-jobs/finalize', {
    method: 'POST',
    headers: {
      ...buildCsrfHeaders(),
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      clientUploadId: initPayload.upload.clientUploadId,
    }),
  });
  const finalizePayload = await finalizeResponse.json();

  if (!finalizeResponse.ok) {
    throw new Error(finalizePayload.error || 'Failed to create import job');
  }

  return finalizePayload.job as ImportJobListItem;
}

export async function postImportJobAction(path: string) {
  const response = await fetch(path, {
    method: 'POST',
    headers: buildCsrfHeaders(),
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || 'Failed to queue job action');
  }
}

async function createImportJobMultipart(formData: FormData) {
  const response = await fetch('/api/import-jobs', {
    method: 'POST',
    headers: buildCsrfHeaders(),
    body: formData,
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || 'Failed to create import job');
  }

  return payload.job as ImportJobListItem;
}
