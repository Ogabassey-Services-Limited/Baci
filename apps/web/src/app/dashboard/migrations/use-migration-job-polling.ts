'use client';

import { useEffect, useRef } from 'react';
import type {
  ImportJobDetail,
  ImportJobListItem,
  ImportJobRowsResponse,
  MigrationPreviewFilter,
} from '@/app/dashboard/migrations/migration-types';
import {
  isMigrationStatusActive,
  shouldFetchMigrationRows,
} from '@/app/dashboard/migrations/migration-utils';
import { createClient } from '@/lib/supabase/client';

const FALLBACK_POLL_MS = 5000;

interface UseMigrationJobPollingInput {
  activeFilter: MigrationPreviewFilter;
  onRealtimeJobUpdate?: (job: Partial<ImportJobListItem>) => void;
  onRefreshRequestIdBump?: () => void;
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
  onRealtimeJobUpdate,
  onRefreshRequestIdBump,
  refreshJob,
  rowsResponse,
  selectedJob,
  selectedJobId,
}: UseMigrationJobPollingInput) {
  const selectedJobStatus = selectedJob?.status;
  const selectedJobStatusRef = useRef(selectedJobStatus);
  selectedJobStatusRef.current = selectedJobStatus;

  useEffect(() => {
    if (
      !selectedJobId ||
      !selectedJobStatus ||
      !isMigrationStatusActive(selectedJobStatus)
    ) {
      return;
    }

    const supabase = createClient();
    let cancelled = false;
    let timeoutId: number | undefined;

    // Primary: Supabase Realtime subscription
    const channel = supabase
      .channel(`import-job-${selectedJobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'import_jobs',
          filter: `id=eq.${selectedJobId}`,
        },
        (payload) => {
          if (cancelled) {
            return;
          }

          const newJob = payload.new as Partial<ImportJobListItem>;

          // Bump request ID to invalidate any in-flight polls
          onRefreshRequestIdBump?.();

          // Route through normalize path
          onRealtimeJobUpdate?.(newJob);

          // Terminal transition: fetch rows when job becomes row-fetchable.
          // Must use includeJob: true because selectedJobRef still holds the
          // stale status (React hasn't re-rendered yet) and refreshJob uses it
          // to decide whether rows should be fetched.
          const previousStatus = selectedJobStatusRef.current;
          const newStatus = newJob.status;
          if (
            previousStatus &&
            isMigrationStatusActive(previousStatus) &&
            newStatus &&
            shouldFetchMigrationRows(newStatus)
          ) {
            void refreshJob(selectedJobId, {
              background: true,
              includeJob: true,
              includeRows: true,
              filter: activeFilter,
              page: rowsResponse?.pagination.page || 1,
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Subscription failed — polling fallback will keep the UI updated
          supabase.removeChannel(channel);
        }
      });

    // Fallback: poll every 5s for resilience
    const poll = async () => {
      await refreshJob(selectedJobId, {
        background: true,
        filter: activeFilter,
        page: rowsResponse?.pagination.page || 1,
      });

      if (!cancelled) {
        timeoutId = window.setTimeout(poll, FALLBACK_POLL_MS);
      }
    };

    timeoutId = window.setTimeout(poll, FALLBACK_POLL_MS);

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      supabase.removeChannel(channel);
    };
  }, [
    activeFilter,
    onRealtimeJobUpdate,
    onRefreshRequestIdBump,
    refreshJob,
    rowsResponse?.pagination.page,
    selectedJobStatus,
    selectedJobId,
  ]);
}
