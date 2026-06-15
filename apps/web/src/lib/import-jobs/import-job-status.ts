import type { ImportJobStatus } from '@/schemas/import-jobs';

const IMPORT_JOB_ACTIVE_STATUSES = [
  'uploaded',
  'validating',
  'commit_queued',
  'committing',
  'notify_queued',
  'notifying',
] as const satisfies readonly ImportJobStatus[];

const IMPORT_JOB_TERMINAL_STATUSES = [
  'preview_ready',
  'committed',
  'completed',
  'failed',
] as const satisfies readonly ImportJobStatus[];

export type ActiveImportJobStatus = (typeof IMPORT_JOB_ACTIVE_STATUSES)[number];
export type TerminalImportJobStatus =
  (typeof IMPORT_JOB_TERMINAL_STATUSES)[number];

export function isImportJobActive(
  status: string
): status is ActiveImportJobStatus {
  return (IMPORT_JOB_ACTIVE_STATUSES as readonly string[]).includes(status);
}

export function isImportJobTerminal(
  status: string
): status is TerminalImportJobStatus {
  return (IMPORT_JOB_TERMINAL_STATUSES as readonly string[]).includes(status);
}
