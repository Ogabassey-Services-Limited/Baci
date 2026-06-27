import { fetchImportJobRows } from '@/app/dashboard/migrations/migration-job-api';
import type {
  ImportJobDetail,
  ImportJobRowsResponse,
  MigrationPreviewFilter,
} from '@/app/dashboard/migrations/migration-types';
import {
  getMigrationRowsCacheKey,
  isMigrationStatusActive,
} from '@/app/dashboard/migrations/migration-utils';

const MAX_ROWS_CACHE_ENTRIES = 50;

export type RowsCache = Map<string, ImportJobRowsResponse>;

export function getCachedRowsEntry(rowsCache: RowsCache, cacheKey: string) {
  const cachedRows = rowsCache.get(cacheKey);
  if (!cachedRows) {
    return null;
  }

  rowsCache.delete(cacheKey);
  rowsCache.set(cacheKey, cachedRows);
  return cachedRows;
}

export function setCachedRowsEntry(
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

export async function prefetchRowsPage(
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
