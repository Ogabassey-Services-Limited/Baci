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

type RowsCache = Map<string, ImportJobRowsResponse>;

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

interface RefreshJobOptions {
  background?: boolean;
  filter?: MigrationPreviewFilter;
  includeJob?: boolean;
  includeRows?: boolean;
  page?: number;
}

interface RunRefreshJobContext extends UseMigrationJobRefreshInput {
  loadingRequestIdRef: MutableRefObject<number | null>;
  refreshInFlightCountRef: MutableRefObject<number>;
  refreshRequestIdRef: MutableRefObject<number>;
  rowsCache: RowsCache;
  rowsLoadingRequestIdRef: MutableRefObject<number | null>;
}

function getCachedRowsEntry(rowsCache: RowsCache, cacheKey: string) {
  const cachedRows = rowsCache.get(cacheKey);
  if (!cachedRows) {
    return null;
  }

  rowsCache.delete(cacheKey);
  rowsCache.set(cacheKey, cachedRows);
  return cachedRows;
}

function setCachedRowsEntry(
  rowsCache: RowsCache,
  cacheKey: string,
  rowsPayload: ImportJobRowsResponse
) {
  if (rowsCache.has(cacheKey)) {
    rowsCache.delete(cacheKey);
  }

  rowsCache.set(cacheKey, rowsPayload);

  while (rowsCache.size > MAX_ROWS_CACHE_ENTRIES) {
    const oldestKey = rowsCache.keys().next().value;
    if (!oldestKey) {
      break;
    }

    rowsCache.delete(oldestKey);
  }
}

async function prefetchRowsPage(
  rowsCache: RowsCache,
  jobId: string,
  status: ImportJobDetail['status'],
  filter: MigrationPreviewFilter,
  page: number,
  pageSize: number,
  total: number
) {
  if (isMigrationStatusActive(status) || total <= page * pageSize) {
    return;
  }

  const nextPage = page + 1;
  const cacheKey = getMigrationRowsCacheKey(jobId, filter, nextPage);
  if (rowsCache.has(cacheKey)) {
    return;
  }

  try {
    const rowsPayload = await fetchImportJobRows(jobId, nextPage, filter);
    setCachedRowsEntry(rowsCache, cacheKey, rowsPayload);
  } catch {
    return;
  }
}

async function runRefreshJob(
  context: RunRefreshJobContext,
  jobId: string,
  options?: RefreshJobOptions
): Promise<boolean> {
  const {
    activeFilter,
    loadingRequestIdRef,
    refreshInFlightCountRef,
    refreshRequestIdRef,
    rowsCache,
    rowsLoadingRequestIdRef,
    selectedJobIdRef,
    selectedJobRef,
    setError,
    setJobs,
    setLoading,
    setRowsLoading,
    setRowsResponse,
    setSelectedJob,
  } = context;

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
      const cachedRows = canUseCache
        ? getCachedRowsEntry(rowsCache, cacheKey)
        : null;

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
      setCachedRowsEntry(rowsCache, cacheKey, rowsPayload);
      if (selectedJobIdRef.current === jobId) {
        setRowsResponse(rowsPayload);
      }
      void prefetchRowsPage(
        rowsCache,
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
  // Mutable cache that never drives rendering: a guarded lazy ref (the
  // react.dev-documented "avoid recreating the ref contents" pattern) keeps a
  // stable Map without per-render allocation and without parking a mutated
  // value in useState. The getter only runs inside event callbacks.
  const rowsCacheRef = useRef<RowsCache | null>(null);
  const getRowsCache = (): RowsCache => {
    if (rowsCacheRef.current === null) {
      rowsCacheRef.current = new Map();
    }
    return rowsCacheRef.current;
  };

  const clearRowsCacheForJob = useEffectEvent((jobId: string) => {
    const rowsCache = getRowsCache();
    const cacheKeyPrefix = getMigrationRowsCacheKeyPrefix(jobId);
    for (const key of Array.from(rowsCache.keys())) {
      if (key.startsWith(cacheKeyPrefix)) {
        rowsCache.delete(key);
      }
    }
  });

  const pruneRowsCacheForJobs = useEffectEvent((jobIds: string[]) => {
    const rowsCache = getRowsCache();
    const activeJobPrefixes = jobIds.map((jobId) =>
      getMigrationRowsCacheKeyPrefix(jobId)
    );

    for (const key of Array.from(rowsCache.keys())) {
      if (!activeJobPrefixes.some((prefix) => key.startsWith(prefix))) {
        rowsCache.delete(key);
      }
    }
  });

  const refreshJob = useEffectEvent(
    (jobId: string, options?: RefreshJobOptions) =>
      runRefreshJob(
        {
          activeFilter,
          loadingRequestIdRef,
          refreshInFlightCountRef,
          refreshRequestIdRef,
          rowsCache: getRowsCache(),
          rowsLoadingRequestIdRef,
          selectedJobIdRef,
          selectedJobRef,
          setError,
          setJobs,
          setLoading,
          setRowsLoading,
          setRowsResponse,
          setSelectedJob,
        },
        jobId,
        options
      )
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
