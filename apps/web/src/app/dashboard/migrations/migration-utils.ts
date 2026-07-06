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

function summaryNumber(
  summary: Record<string, unknown> | null | undefined,
  key: string
) {
  const value = summary?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function getClampedPercent(processed: number, total: number) {
  if (total <= 0) {
    return null;
  }

  return Math.min(
    99,
    Math.max(
      processed > 0 ? 1 : 0,
      Math.round((Math.max(0, processed) / total) * 100)
    )
  );
}

function getLifecycleStagePercent(
  processed: number,
  total: number,
  start: number,
  end: number
) {
  if (total <= 0) {
    return null;
  }

  const ratio = Math.min(1, Math.max(0, processed) / total);
  return Math.min(
    end,
    Math.max(start, Math.round(start + ratio * (end - start)))
  );
}

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
  totalRows = 0,
  summary?: Record<string, unknown> | null
): number | null {
  switch (status) {
    case 'uploaded':
      return 18;
    case 'validating':
      return getClampedPercent(processedRows, totalRows);
    case 'commit_queued':
      return 68;
    case 'committing':
      return (
        getLifecycleStagePercent(
          summaryNumber(summary, 'commitProcessedRecords'),
          summaryNumber(summary, 'commitTotalRecords'),
          84,
          91
        ) ?? 84
      );
    case 'notify_queued':
      return 92;
    case 'notifying':
      return (
        getLifecycleStagePercent(
          summaryNumber(summary, 'notificationProcessedRecipients'),
          summaryNumber(summary, 'notificationTotalRecipients'),
          97,
          99
        ) ?? 97
      );
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
  totalRows = 0,
  summary?: Record<string, unknown> | null
) {
  if (status === 'validating') {
    if (totalRows <= 0) {
      return 'Loading and parsing file...';
    }

    const safeProcessedRows = Math.max(0, Math.min(processedRows, totalRows));
    return `${safeProcessedRows.toLocaleString()} of ${totalRows.toLocaleString()} rows processed`;
  }

  if (status === 'committing') {
    const totalRecords = summaryNumber(summary, 'commitTotalRecords');
    if (totalRecords <= 0) {
      return 'Preparing records for import...';
    }

    const processedRecords = Math.min(
      summaryNumber(summary, 'commitProcessedRecords'),
      totalRecords
    );
    return `${processedRecords.toLocaleString()} of ${totalRecords.toLocaleString()} records imported`;
  }

  if (status === 'notifying') {
    const totalRecipients = summaryNumber(
      summary,
      'notificationTotalRecipients'
    );
    if (totalRecipients <= 0) {
      return 'Preparing customer email recipients...';
    }

    const processedRecipients = Math.min(
      summaryNumber(summary, 'notificationProcessedRecipients'),
      totalRecipients
    );
    return `${processedRecipients.toLocaleString()} of ${totalRecipients.toLocaleString()} customer emails processed`;
  }

  return null;
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

function shouldFetchMigrationRows(status: ImportJobStatus) {
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

export function shouldIncludeMigrationJobDetailsForRows(
  job: Pick<ImportJobDetail, 'entity_type' | 'notified_at' | 'status'>
) {
  return (
    job.entity_type === 'orders' &&
    (job.status === 'committed' ||
      job.status === 'completed' ||
      Boolean(job.notified_at))
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
  statuses: Array<{
    id: string;
    status: ImportJobStatus;
    processed_rows?: number | null;
  }>
) {
  return (
    statuses.find((job) =>
      canLoadMigrationRows(job.status, job.processed_rows ?? 0)
    )?.id ?? null
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
