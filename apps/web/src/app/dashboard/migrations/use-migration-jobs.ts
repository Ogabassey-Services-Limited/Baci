'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  createImportJob,
  mergeJobs,
  postImportJobAction,
} from '@/app/dashboard/migrations/migration-job-api';
import type {
  ImportJobDetail,
  ImportJobListItem,
  ImportJobRowsResponse,
  MigrationPreviewFilter,
} from '@/app/dashboard/migrations/migration-types';
import {
  canLoadMigrationRows,
  decorateImportJob,
  getInitialMigrationSelection,
  isMigrationStatusActive,
} from '@/app/dashboard/migrations/migration-utils';
import { useMigrationJobPolling } from '@/app/dashboard/migrations/use-migration-job-polling';
import { useMigrationJobRefresh } from '@/app/dashboard/migrations/use-migration-job-refresh';

export function useMigrationJobs({
  initialError,
  initialJobs,
}: {
  initialError?: string | null;
  initialJobs: ImportJobListItem[];
}) {
  const initialSelectedJobId = getInitialMigrationSelection(initialJobs);
  const [entityType, setEntityType] = useState<'orders' | 'products'>('orders');
  const [file, setFile] = useState<File | null>(null);
  const [jobs, setJobs] = useState(initialJobs);
  const [selectedJobId, setSelectedJobId] = useState(initialSelectedJobId);
  const [selectedJob, setSelectedJob] = useState<ImportJobDetail | null>(() => {
    const initialSelectedJob =
      initialJobs.find((job) => job.id === initialSelectedJobId) || null;
    return initialSelectedJob ? decorateImportJob(initialSelectedJob) : null;
  });
  const [rowsResponse, setRowsResponse] =
    useState<ImportJobRowsResponse | null>(null);
  const [activeFilter, setActiveFilter] =
    useState<MigrationPreviewFilter>('all');
  const [loading, setLoading] = useState(false);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const jobsRef = useRef(jobs);
  const selectedJobIdRef = useRef(selectedJobId);
  const selectedJobRef = useRef(selectedJob);

  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  useEffect(() => {
    selectedJobIdRef.current = selectedJobId;
  }, [selectedJobId]);

  useEffect(() => {
    selectedJobRef.current = selectedJob;
  }, [selectedJob]);

  const {
    clearRowsCacheForJob,
    invalidateRefreshRequests,
    isRefreshInFlight,
    pruneRowsCacheForJobs,
    refreshJob,
  } = useMigrationJobRefresh({
    activeFilter,
    selectedJobIdRef,
    selectedJobRef,
    setError,
    setJobs,
    setLoading,
    setRowsLoading,
    setRowsResponse,
    setSelectedJob,
  });

  useEffect(() => {
    pruneRowsCacheForJobs(jobs.map((job) => job.id));
  }, [jobs, pruneRowsCacheForJobs]);

  const handleSelectedJobChange = useEffectEvent(
    (nextSelectedJobId: string | null) => {
      if (!nextSelectedJobId) {
        setSelectedJob(null);
        setRowsResponse(null);
        return;
      }

      setActiveFilter('all');
      setRowsResponse(null);

      const nextSelectedJob =
        jobsRef.current.find((job) => job.id === nextSelectedJobId) || null;
      if (nextSelectedJob) {
        const decoratedJob = decorateImportJob(nextSelectedJob);
        setSelectedJob(decoratedJob);
        const canLoadRows = canLoadMigrationRows(
          decoratedJob.status,
          decoratedJob.processed_rows
        );

        if (isMigrationStatusActive(decoratedJob.status)) {
          void refreshJob(nextSelectedJobId, {
            background: true,
            filter: 'all',
            includeJob: !canLoadRows,
            includeRows: true,
          });
        } else if (canLoadRows) {
          void refreshJob(nextSelectedJobId, {
            filter: 'all',
            includeJob: false,
            includeRows: true,
          });
        }
        return;
      }

      setSelectedJob(null);
      void refreshJob(nextSelectedJobId, { filter: 'all' });
    }
  );

  useEffect(() => {
    void handleSelectedJobChange(selectedJobId);
  }, [selectedJobId]);

  useEffect(() => {
    if (!selectedJobId) {
      return;
    }

    const nextSelectedJob = jobs.find((job) => job.id === selectedJobId);
    if (nextSelectedJob) {
      setSelectedJob(decorateImportJob(nextSelectedJob));
    }
  }, [jobs, selectedJobId]);

  const handleRealtimeJobUpdate = useEffectEvent(
    (partial: Partial<ImportJobListItem>) => {
      if (!partial.id) {
        return;
      }

      clearRowsCacheForJob(partial.id);

      setJobs((currentJobs) => {
        const existing = currentJobs.find((j) => j.id === partial.id);
        if (!existing) {
          return currentJobs;
        }

        const merged = { ...existing, ...partial } as ImportJobListItem;
        return mergeJobs(currentJobs, merged);
      });
    }
  );

  const handleRefreshRequestIdBump = useEffectEvent(() => {
    invalidateRefreshRequests();
  });

  useMigrationJobPolling({
    activeFilter,
    isRefreshInFlight,
    onRealtimeJobUpdate: handleRealtimeJobUpdate,
    onRefreshRequestIdBump: handleRefreshRequestIdBump,
    refreshJob,
    rowsResponse,
    selectedJob,
    selectedJobId,
  });
  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError('Choose a CSV file to start the migration preview.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const nextJob = await createImportJob({
        entityType,
        file,
        sourcePlatform: 'bumpa',
      });
      setJobs((currentJobs) => mergeJobs(currentJobs, nextJob));
      setSelectedJobId(nextJob.id);
      setFile(null);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : 'Upload failed'
      );
    } finally {
      setUploading(false);
    }
  }

  async function queueJobAction(path: string) {
    if (!selectedJobId) {
      return;
    }

    setActing(true);
    setError(null);

    try {
      await postImportJobAction(path);

      await refreshJob(selectedJobId, {
        filter: activeFilter,
        page: rowsResponse?.pagination?.page || 1,
      });
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : 'Action failed'
      );
    } finally {
      setActing(false);
    }
  }

  async function handleFilterChange(filter: MigrationPreviewFilter) {
    const currentJobId = selectedJobIdRef.current;
    const currentSelectedJob = selectedJobRef.current;

    if (!currentJobId || !currentSelectedJob) {
      return;
    }

    if (
      !canLoadMigrationRows(
        currentSelectedJob.status,
        currentSelectedJob.processed_rows
      )
    ) {
      return;
    }

    const previousRowsResponse = rowsResponse;
    setRowsResponse(null);

    const didRefresh = await refreshJob(currentJobId, {
      filter,
      includeJob: false,
      includeRows: true,
      page: 1,
    });

    if (selectedJobIdRef.current !== currentJobId) {
      return;
    }

    if (didRefresh) {
      setActiveFilter(filter);
      return;
    }

    setRowsResponse(previousRowsResponse);
  }

  return {
    activeFilter,
    acting,
    entityType,
    error,
    file,
    handleFilterChange,
    handleUpload,
    jobs,
    loading,
    queueJobAction,
    refreshJob,
    rowsLoading,
    rowsResponse,
    selectedJob,
    selectedJobId,
    setEntityType,
    setFile,
    setSelectedJobId,
    uploading,
  };
}
