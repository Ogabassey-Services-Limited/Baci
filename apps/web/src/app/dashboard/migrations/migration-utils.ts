import type { ImportJobStatus } from '@/schemas/import-jobs';

const ACTIVE_MIGRATION_STATUSES = new Set<ImportJobStatus>([
  'uploaded',
  'validating',
  'commit_queued',
  'committing',
  'notify_queued',
  'notifying',
]);

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

export function getMigrationProgressValue(status: ImportJobStatus) {
  switch (status) {
    case 'uploaded':
      return 18;
    case 'validating':
      return 56;
    case 'commit_queued':
      return 68;
    case 'committing':
      return 84;
    case 'notify_queued':
      return 92;
    case 'notifying':
      return 97;
    case 'preview_ready':
    case 'committed':
    case 'completed':
      return 100;
    default:
      return 0;
  }
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

export function getInitialMigrationSelection(
  statuses: Array<{ id: string; status: ImportJobStatus }>
) {
  return (
    statuses.find((job) => shouldFetchMigrationRows(job.status))?.id ?? null
  );
}
