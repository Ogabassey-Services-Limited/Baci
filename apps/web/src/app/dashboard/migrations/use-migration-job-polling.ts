'use client';

import { useEffect } from 'react';
import type {
  ImportJobDetail,
  ImportJobRowsResponse,
  MigrationPreviewFilter,
} from '@/app/dashboard/migrations/migration-types';
import { isMigrationStatusActive } from '@/app/dashboard/migrations/migration-utils';

interface UseMigrationJobPollingInput {
  activeFilter: MigrationPreviewFilter;
  refreshJob: (
    jobId: string,
    options?: {
      background?: boolean;
      filter?: MigrationPreviewFilter;
      includeJob?: boolean;
      includeRows?: boolean;
      page?: number;
    }
  ) => Promise<boolean>;
  rowsResponse: ImportJobRowsResponse | null;
  selectedJob: ImportJobDetail | null;
  selectedJobId: string | null;
}

export function useMigrationJobPolling({
  activeFilter,
  refreshJob,
  rowsResponse,
  selectedJob,
  selectedJobId,
}: UseMigrationJobPollingInput) {
  useEffect(() => {
    if (
      !selectedJobId ||
      !selectedJob ||
      !isMigrationStatusActive(selectedJob.status)
    ) {
      return;
    }

    const pollDelay = selectedJob.status === 'validating' ? 1000 : 2500;
    let cancelled = false;
    let timeoutId: number | undefined;

    const poll = async () => {
      await refreshJob(selectedJobId, {
        background: true,
        filter: activeFilter,
        page: rowsResponse?.pagination.page || 1,
      });

      if (!cancelled) {
        timeoutId = window.setTimeout(poll, pollDelay);
      }
    };

    timeoutId = window.setTimeout(poll, pollDelay);

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [
    activeFilter,
    refreshJob,
    rowsResponse?.pagination.page,
    selectedJob,
    selectedJobId,
  ]);
}
