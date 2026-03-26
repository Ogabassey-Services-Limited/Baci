import type {
  ImportJobDetail,
  ImportJobListItem,
  ImportJobRowsResponse,
  MigrationPreviewFilter,
} from '@/app/dashboard/migrations/migration-types';
import { buildCsrfHeaders } from '@/lib/csrf';

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

export async function createImportJob(
  formData: FormData
): Promise<ImportJobListItem> {
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
