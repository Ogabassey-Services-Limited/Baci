'use client';

import {
  getMigrationProgressDetail,
  getMigrationProgressLabel,
  getMigrationProgressValue,
  isMigrationStatusActive,
} from '@/app/dashboard/migrations/migration-utils';
import { Progress } from '@/components/ui/progress';
import type { ImportJobStatus } from '@/schemas/import-jobs';

interface MigrationJobProgressCardProps {
  processedRows: number;
  status: ImportJobStatus;
  summary: Record<string, unknown> | null;
  totalRows: number;
}

export default function MigrationJobProgressCard({
  processedRows,
  status,
  summary,
  totalRows,
}: MigrationJobProgressCardProps) {
  if (!isMigrationStatusActive(status)) {
    return null;
  }

  const progressLabel = getMigrationProgressLabel(status);
  if (!progressLabel) {
    return null;
  }

  const progressDetail = getMigrationProgressDetail(
    status,
    processedRows,
    totalRows,
    summary
  );
  const progressValue = getMigrationProgressValue(
    status,
    processedRows,
    totalRows,
    summary
  );

  return (
    <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{progressLabel}</p>
        {progressValue != null ? (
          <span className="text-xs font-medium text-muted-foreground">
            {progressValue}%
          </span>
        ) : null}
      </div>
      <Progress
        aria-label="Migration progress"
        className="h-2"
        value={progressValue}
      />
      <p className="text-xs text-muted-foreground">
        {progressDetail ||
          'Job status updates automatically while this stage is running.'}
      </p>
    </div>
  );
}
