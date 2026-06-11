import { isSupported as isTusSupported, Upload } from 'tus-js-client';
import type {
  ImportJobDetail,
  ImportJobListItem,
  ImportJobRowsResponse,
  MigrationPreviewFilter,
} from '@/app/dashboard/migrations/migration-types';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';
import { fetchWithCsrf } from '@/lib/api-client';
import { MIGRATION_IMPORT_BUCKET } from '@/lib/import-jobs/import-job-storage';
import { createClient } from '@/lib/supabase/client';
import type {
  ImportJobEntityType,
  ImportJobSourcePlatform,
} from '@/schemas/import-jobs';

const TUS_CHUNK_SIZE_BYTES = 6 * 1024 * 1024;

export interface ImportUploadProgress {
  bytesUploaded: number;
  bytesTotal: number;
  percent: number;
  stage: 'initializing' | 'uploading' | 'finalizing';
}

interface ImportUploadInitPayload {
  upload: {
    clientUploadId: string;
    storagePath: string;
    uploadToken: string;
  };
}

interface CreateImportJobInput {
  entityType: ImportJobEntityType;
  file: File;
  onUploadProgress?: (progress: ImportUploadProgress) => void;
  sourcePlatform: ImportJobSourcePlatform;
}

function getStorageResumableUploadEndpoint() {
  const supabaseUrl = new URL(getSupabaseUrl());

  if (supabaseUrl.hostname.endsWith('.supabase.co')) {
    supabaseUrl.hostname = supabaseUrl.hostname.replace(
      '.supabase.co',
      '.storage.supabase.co'
    );
  }

  supabaseUrl.pathname = '/storage/v1/upload/resumable';
  supabaseUrl.search = '';
  supabaseUrl.hash = '';

  return supabaseUrl.toString();
}

function toPercent(bytesUploaded: number, bytesTotal: number) {
  if (bytesTotal <= 0) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(0, Math.round((bytesUploaded / bytesTotal) * 100))
  );
}

function reportProgress(
  input: CreateImportJobInput,
  progress: Omit<ImportUploadProgress, 'percent'>
) {
  input.onUploadProgress?.({
    ...progress,
    percent: toPercent(progress.bytesUploaded, progress.bytesTotal),
  });
}

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

async function uploadImportFileWithSignedUrl(
  input: CreateImportJobInput,
  upload: ImportUploadInitPayload['upload']
) {
  const supabase = createClient();
  const { error: uploadError } = await supabase.storage
    .from(MIGRATION_IMPORT_BUCKET)
    .uploadToSignedUrl(upload.storagePath, upload.uploadToken, input.file, {
      contentType: input.file.type || 'text/csv',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message || 'Failed to upload CSV file');
  }

  reportProgress(input, {
    bytesUploaded: input.file.size,
    bytesTotal: input.file.size,
    stage: 'uploading',
  });
}

async function uploadImportFileWithTus(
  input: CreateImportJobInput,
  upload: ImportUploadInitPayload['upload']
) {
  if (!isTusSupported) {
    await uploadImportFileWithSignedUrl(input, upload);
    return;
  }

  const supabase = createClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    throw new Error(
      sessionError?.message || 'Authentication session is required for upload'
    );
  }

  await new Promise<void>((resolve, reject) => {
    const tusUpload = new Upload(input.file, {
      endpoint: getStorageResumableUploadEndpoint(),
      retryDelays: [0, 3000, 5000, 10_000, 20_000],
      headers: {
        apikey: getSupabaseAnonKey(),
        authorization: `Bearer ${session.access_token}`,
        'x-upsert': 'false',
      },
      metadata: {
        bucketName: MIGRATION_IMPORT_BUCKET,
        objectName: upload.storagePath,
        contentType: input.file.type || 'text/csv',
        cacheControl: '3600',
      },
      chunkSize: TUS_CHUNK_SIZE_BYTES,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      onProgress: (bytesUploaded, bytesTotal) => {
        reportProgress(input, {
          bytesUploaded,
          bytesTotal,
          stage: 'uploading',
        });
      },
      onError: (error) => {
        reject(error);
      },
      onSuccess: () => {
        reportProgress(input, {
          bytesUploaded: input.file.size,
          bytesTotal: input.file.size,
          stage: 'uploading',
        });
        resolve();
      },
    });

    tusUpload
      .findPreviousUploads()
      .then((previousUploads) => {
        if (previousUploads[0]) {
          tusUpload.resumeFromPreviousUpload(previousUploads[0]);
        }

        tusUpload.start();
      })
      .catch(reject);
  });
}

export async function createImportJob(
  input: CreateImportJobInput
): Promise<ImportJobListItem> {
  reportProgress(input, {
    bytesUploaded: 0,
    bytesTotal: input.file.size,
    stage: 'initializing',
  });

  const initResponse = await fetchWithCsrf('/api/import-jobs/upload-init', {
    method: 'POST',
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

  await uploadImportFileWithTus(
    input,
    (initPayload as ImportUploadInitPayload).upload
  );

  reportProgress(input, {
    bytesUploaded: input.file.size,
    bytesTotal: input.file.size,
    stage: 'finalizing',
  });

  const finalizeResponse = await fetchWithCsrf('/api/import-jobs/finalize', {
    method: 'POST',
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
  const response = await fetchWithCsrf(path, {
    method: 'POST',
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || 'Failed to queue job action');
  }
}

async function createImportJobMultipart(formData: FormData) {
  const response = await fetchWithCsrf('/api/import-jobs', {
    method: 'POST',
    body: formData,
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || 'Failed to create import job');
  }

  return payload.job as ImportJobListItem;
}
