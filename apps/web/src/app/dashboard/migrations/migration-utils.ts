import type {
  ImportJobDetail,
  ImportJobListItem,
  ImportJobRowStatus,
  MigrationPreviewFilter,
} from '@/app/dashboard/migrations/migration-types';
import type { ImportJobStatus } from '@/schemas/import-jobs';

const ACTIVE_MIGRATION_STATUSES = new Set<ImportJobStatus>([
  'uploaded',
  'validating',
  'commit_queued',
  'committing',
  'notify_queued',
  'notifying',
]);
const MIGRATION_ROWS_CACHE_KEY_DELIMITER = ':';

function encodeMigrationRowsCacheKeyPart(value: string) {
  return encodeURIComponent(value);
}

export function statusBadgeClass(status: ImportJobStatus | string) {
  if (status === 'completed' || status === 'committed') {
    return 'bg-emerald-500/10 text-emerald-700';
  }

  if (status === 'failed') {
    return 'bg-rose-500/10 text-rose-700';
  }

  if (ACTIVE_MIGRATION_STATUSES.has(status as ImportJobStatus)) {
    return 'bg-blue-500/10 text-blue-700';
  }

  return 'bg-muted text-muted-foreground';
}

export function isMigrationStatusActive(status: ImportJobStatus) {
  return ACTIVE_MIGRATION_STATUSES.has(status);
}

export function getMigrationProgressValue(
  status: ImportJobStatus,
  processedRows = 0,
  totalRows = 0
): number | null {
  switch (status) {
    case 'uploaded':
      return 18;
    case 'validating':
      if (totalRows <= 0) {
        return null;
      }

      return Math.min(
        99,
        Math.max(
          processedRows > 0 ? 1 : 0,
          Math.round((processedRows / totalRows) * 100)
        )
      );
    case 'commit_queued':
      return 68;
    case 'committing':
      return 84;
    case 'notify_queued':
      return 92;
    case 'notifying':
      return 97;
    case 'failed':
      return 0;
    case 'preview_ready':
    case 'committed':
    case 'completed':
      return 100;
    default:
      return 0;
  }
}

export function getMigrationProgressDetail(
  status: ImportJobStatus,
  processedRows = 0,
  totalRows = 0
) {
  if (status !== 'validating') {
    return null;
  }

  if (totalRows <= 0) {
    return 'Loading and parsing file...';
  }

  const safeProcessedRows = Math.max(0, Math.min(processedRows, totalRows));
  return `${safeProcessedRows.toLocaleString()} of ${totalRows.toLocaleString()} rows processed`;
}

export function getMigrationProgressLabel(status: ImportJobStatus) {
  switch (status) {
    case 'uploaded':
      return 'Upload complete. Preparing preview...';
    case 'validating':
      return 'Building preview...';
    case 'commit_queued':
      return 'Import queued...';
    case 'committing':
      return 'Importing records...';
    case 'notify_queued':
      return 'Customer notification campaign queued...';
    case 'notifying':
      return 'Sending customer notifications...';
    default:
      return null;
  }
}

export function shouldFetchMigrationRows(status: ImportJobStatus) {
  return status !== 'uploaded' && status !== 'validating';
}

export function canLoadMigrationRows(
  status: ImportJobStatus,
  processedRows = 0
) {
  return (
    shouldFetchMigrationRows(status) ||
    (status === 'validating' && processedRows > 0)
  );
}

export function getMigrationRowsCacheKey(
  jobId: string,
  filter: MigrationPreviewFilter,
  page: number
) {
  return `${getMigrationRowsCacheKeyPrefix(jobId)}${encodeMigrationRowsCacheKeyPart(filter)}${MIGRATION_ROWS_CACHE_KEY_DELIMITER}${page}`;
}

export function getMigrationRowsCacheKeyPrefix(jobId: string) {
  return `${encodeMigrationRowsCacheKeyPart(jobId)}${MIGRATION_ROWS_CACHE_KEY_DELIMITER}`;
}

export function getInitialMigrationSelection(
  statuses: Array<{ id: string; status: ImportJobStatus }>
) {
  return (
    statuses.find((job) => shouldFetchMigrationRows(job.status))?.id ?? null
  );
}

export function decorateImportJob(job: ImportJobListItem): ImportJobDetail {
  const summary = (job.summary || {}) as Record<string, unknown>;
  const validRows =
    typeof summary.validRows === 'number' ? summary.validRows : 0;

  return {
    ...job,
    canCommit: job.status === 'preview_ready' && validRows > 0,
    canNotify:
      job.entity_type === 'orders' &&
      job.status === 'committed' &&
      validRows > 0,
  };
}

export function filterMigrationRows<
  T extends { row_status: ImportJobRowStatus },
>(rows: T[], filter: MigrationPreviewFilter) {
  if (filter === 'importable') {
    return rows.filter(
      (row) => row.row_status === 'create' || row.row_status === 'update'
    );
  }

  if (filter === 'needs_fix') {
    return rows.filter((row) => row.row_status === 'invalid');
  }

  return rows;
}
