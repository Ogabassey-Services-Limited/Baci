'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  createImportJob,
  fetchImportJob,
  fetchImportJobRows,
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
  getMigrationRowsCacheKey,
  getMigrationRowsCacheKeyPrefix,
  isMigrationStatusActive,
} from '@/app/dashboard/migrations/migration-utils';
import { useMigrationJobPolling } from '@/app/dashboard/migrations/use-migration-job-polling';

const MAX_ROWS_CACHE_ENTRIES = 50;

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
  const loadingRequestIdRef = useRef<number | null>(null);
  const refreshRequestIdRef = useRef(0);
  const refreshInFlightCountRef = useRef(0);
  const rowsLoadingRequestIdRef = useRef<number | null>(null);
  const rowsCacheRef = useRef(new Map<string, ImportJobRowsResponse>());
  const selectedJobIdRef = useRef(selectedJobId);
  const selectedJobRef = useRef(selectedJob);

  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  useEffect(() => {
    const activeJobPrefixes = jobs.map((job) =>
      getMigrationRowsCacheKeyPrefix(job.id)
    );

    for (const key of rowsCacheRef.current.keys()) {
      if (!activeJobPrefixes.some((prefix) => key.startsWith(prefix))) {
        rowsCacheRef.current.delete(key);
      }
    }
  }, [jobs]);

  useEffect(() => {
    selectedJobIdRef.current = selectedJobId;
  }, [selectedJobId]);

  useEffect(() => {
    selectedJobRef.current = selectedJob;
  }, [selectedJob]);

  const getCachedRowsEntry = useEffectEvent((cacheKey: string) => {
    const cachedRows = rowsCacheRef.current.get(cacheKey);
    if (!cachedRows) {
      return null;
    }

    rowsCacheRef.current.delete(cacheKey);
    rowsCacheRef.current.set(cacheKey, cachedRows);
    return cachedRows;
  });

  const setCachedRowsEntry = useEffectEvent(
    (cacheKey: string, rowsPayload: ImportJobRowsResponse) => {
      if (rowsCacheRef.current.has(cacheKey)) {
        rowsCacheRef.current.delete(cacheKey);
      }

      rowsCacheRef.current.set(cacheKey, rowsPayload);

      while (rowsCacheRef.current.size > MAX_ROWS_CACHE_ENTRIES) {
        const oldestKey = rowsCacheRef.current.keys().next().value;
        if (!oldestKey) {
          break;
        }

        rowsCacheRef.current.delete(oldestKey);
      }
    }
  );

  const clearRowsCacheForJob = useEffectEvent((jobId: string) => {
    const cacheKeyPrefix = getMigrationRowsCacheKeyPrefix(jobId);
    for (const key of rowsCacheRef.current.keys()) {
      if (key.startsWith(cacheKeyPrefix)) {
        rowsCacheRef.current.delete(key);
      }
    }
  });

  const prefetchRowsPage = useEffectEvent(
    async (
      jobId: string,
      status: ImportJobDetail['status'],
      filter: MigrationPreviewFilter,
      page: number,
      pageSize: number,
      total: number
    ) => {
      if (isMigrationStatusActive(status) || total <= page * pageSize) {
        return;
      }

      const nextPage = page + 1;
      const cacheKey = getMigrationRowsCacheKey(jobId, filter, nextPage);
      if (rowsCacheRef.current.has(cacheKey)) {
        return;
      }

      try {
        const rowsPayload = await fetchImportJobRows(jobId, nextPage, filter);
        setCachedRowsEntry(cacheKey, rowsPayload);
      } catch {
        return;
      }
    }
  );

  const refreshJob = useEffectEvent(
    async (
      jobId: string,
      options?: {
        background?: boolean;
        filter?: MigrationPreviewFilter;
        includeJob?: boolean;
        includeRows?: boolean;
        page?: number;
      }
    ) => {
      const page = options?.page || 1;
      const background = options?.background ?? false;
      const includeJob = options?.includeJob ?? true;
      const includeRows = options?.includeRows ?? true;
      const filter = options?.filter ?? activeFilter;
      const requestId = ++refreshRequestIdRef.current;

      if (!background && includeJob) {
        loadingRequestIdRef.current = requestId;
        setLoading(true);
      }
      if (!background && includeRows) {
        rowsLoadingRequestIdRef.current = requestId;
        setRowsLoading(true);
      }
      if (!background) {
        setError(null);
      }
      refreshInFlightCountRef.current++;

      try {
        let nextJob =
          selectedJobIdRef.current === jobId ? selectedJobRef.current : null;

        if (includeJob) {
          nextJob = await fetchImportJob(jobId);
          if (requestId !== refreshRequestIdRef.current) {
            return false;
          }
          setJobs((currentJobs) =>
            mergeJobs(currentJobs, nextJob as ImportJobListItem)
          );
          if (selectedJobIdRef.current === jobId) {
            setSelectedJob(nextJob);
          }
        }

        if (
          !nextJob ||
          !canLoadMigrationRows(nextJob.status, nextJob.processed_rows)
        ) {
          if (
            requestId === refreshRequestIdRef.current &&
            selectedJobIdRef.current === jobId
          ) {
            setRowsResponse(null);
          }
          return true;
        }

        if (includeRows) {
          const cacheKey = getMigrationRowsCacheKey(jobId, filter, page);
          const canUseCache =
            !background && !isMigrationStatusActive(nextJob.status);
          const cachedRows = canUseCache ? getCachedRowsEntry(cacheKey) : null;

          if (cachedRows) {
            if (selectedJobIdRef.current === jobId) {
              setRowsResponse(cachedRows);
            }
            return true;
          }

          const rowsPayload = await fetchImportJobRows(jobId, page, filter);
          if (requestId !== refreshRequestIdRef.current) {
            return false;
          }
          setCachedRowsEntry(cacheKey, rowsPayload);
          if (selectedJobIdRef.current === jobId) {
            setRowsResponse(rowsPayload);
          }
          void prefetchRowsPage(
            jobId,
            nextJob.status,
            filter,
            page,
            rowsPayload.pagination.pageSize,
            rowsPayload.pagination.total
          );
        }
        return true;
      } catch (jobError) {
        if (requestId !== refreshRequestIdRef.current) {
          return false;
        }

        if (background) {
          return false;
        }

        if (selectedJobIdRef.current === jobId || !selectedJobIdRef.current) {
          setError(
            jobError instanceof Error
              ? jobError.message
              : 'Failed to load import job'
          );
        }
        return false;
      } finally {
        refreshInFlightCountRef.current = Math.max(
          0,
          refreshInFlightCountRef.current - 1
        );
        if (
          !background &&
          includeJob &&
          loadingRequestIdRef.current === requestId
        ) {
          loadingRequestIdRef.current = null;
          setLoading(false);
        }
        if (
          !background &&
          includeRows &&
          rowsLoadingRequestIdRef.current === requestId
        ) {
          rowsLoadingRequestIdRef.current = null;
          setRowsLoading(false);
        }
      }
    }
  );

  useEffect(() => {
    if (!selectedJobId) {
      setSelectedJob(null);
      setRowsResponse(null);
      return;
    }

    setActiveFilter('all');
    setRowsResponse(null);

    const nextSelectedJob =
      jobsRef.current.find((job) => job.id === selectedJobId) || null;
    if (nextSelectedJob) {
      const decoratedJob = decorateImportJob(nextSelectedJob);
      setSelectedJob(decoratedJob);

      if (isMigrationStatusActive(decoratedJob.status)) {
        void refreshJob(selectedJobId, {
          background: true,
          filter: 'all',
          includeJob: true,
          includeRows: true,
        });
      } else if (
        canLoadMigrationRows(decoratedJob.status, decoratedJob.processed_rows)
      ) {
        void refreshJob(selectedJobId, {
          filter: 'all',
          includeJob: false,
          includeRows: true,
        });
      }
      return;
    }

    setSelectedJob(null);
    void refreshJob(selectedJobId, { filter: 'all' });
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
    refreshRequestIdRef.current++;
  });

  const isRefreshInFlight = useEffectEvent(
    () => refreshInFlightCountRef.current > 0
  );

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

    const formData = new FormData();
    formData.set('sourcePlatform', 'bumpa');
    formData.set('entityType', entityType);
    formData.set('file', file);

    try {
      const nextJob = await createImportJob(formData);
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
