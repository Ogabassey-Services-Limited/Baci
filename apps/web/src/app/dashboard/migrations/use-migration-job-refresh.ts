'use client';

import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useEffectEvent,
  useRef,
} from 'react';
import {
  fetchImportJob,
  fetchImportJobRows,
  mergeJobs,
} from '@/app/dashboard/migrations/migration-job-api';
import type {
  ImportJobDetail,
  ImportJobListItem,
  ImportJobRowsResponse,
  MigrationPreviewFilter,
} from '@/app/dashboard/migrations/migration-types';
import {
  canLoadMigrationRows,
  getMigrationRowsCacheKey,
  getMigrationRowsCacheKeyPrefix,
  isMigrationStatusActive,
} from '@/app/dashboard/migrations/migration-utils';

const MAX_ROWS_CACHE_ENTRIES = 50;

interface UseMigrationJobRefreshInput {
  activeFilter: MigrationPreviewFilter;
  selectedJobIdRef: MutableRefObject<string | null>;
  selectedJobRef: MutableRefObject<ImportJobDetail | null>;
  setError: Dispatch<SetStateAction<string | null>>;
  setJobs: Dispatch<SetStateAction<ImportJobListItem[]>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setRowsLoading: Dispatch<SetStateAction<boolean>>;
  setRowsResponse: Dispatch<SetStateAction<ImportJobRowsResponse | null>>;
  setSelectedJob: Dispatch<SetStateAction<ImportJobDetail | null>>;
}

export function useMigrationJobRefresh({
  activeFilter,
  selectedJobIdRef,
  selectedJobRef,
  setError,
  setJobs,
  setLoading,
  setRowsLoading,
  setRowsResponse,
  setSelectedJob,
}: UseMigrationJobRefreshInput) {
  const loadingRequestIdRef = useRef<number | null>(null);
  const refreshRequestIdRef = useRef(0);
  const refreshInFlightCountRef = useRef(0);
  const rowsLoadingRequestIdRef = useRef<number | null>(null);
  const rowsCacheRef = useRef(new Map<string, ImportJobRowsResponse>());

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
    for (const key of Array.from(rowsCacheRef.current.keys())) {
      if (key.startsWith(cacheKeyPrefix)) {
        rowsCacheRef.current.delete(key);
      }
    }
  });

  const pruneRowsCacheForJobs = useEffectEvent((jobIds: string[]) => {
    const activeJobPrefixes = jobIds.map((jobId) =>
      getMigrationRowsCacheKeyPrefix(jobId)
    );

    for (const key of Array.from(rowsCacheRef.current.keys())) {
      if (!activeJobPrefixes.some((prefix) => key.startsWith(prefix))) {
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

  const invalidateRefreshRequests = useEffectEvent(() => {
    refreshRequestIdRef.current++;
  });

  const isRefreshInFlight = useEffectEvent(
    () => refreshInFlightCountRef.current > 0
  );

  return {
    clearRowsCacheForJob,
    invalidateRefreshRequests,
    isRefreshInFlight,
    pruneRowsCacheForJobs,
    refreshJob,
  };
}
