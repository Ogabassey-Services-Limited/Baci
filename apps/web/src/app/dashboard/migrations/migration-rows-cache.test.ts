import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImportJobRowsResponse } from '@/app/dashboard/migrations/migration-types';
import {
  getCachedRowsEntry,
  prefetchRowsPage,
  type RowsCache,
  setCachedRowsEntry,
} from './migration-rows-cache';

vi.mock('@/app/dashboard/migrations/migration-job-api', () => ({
  fetchImportJobRows: vi.fn(),
}));

import { fetchImportJobRows } from '@/app/dashboard/migrations/migration-job-api';

function rowsResponse(rowId: string): ImportJobRowsResponse {
  return {
    pagination: { page: 1, pageSize: 25, total: 1 },
    rows: [
      {
        id: rowId,
        meta: {},
        normalized_payload: null,
        row_number: 1,
        row_status: 'create',
        source_external_id: null,
        source_payload: {},
        validation_errors: [],
      },
    ],
  };
}

describe('migration rows cache', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns cached rows and refreshes their recency', () => {
    const cache: RowsCache = new Map([
      ['first', rowsResponse('row-first')],
      ['second', rowsResponse('row-second')],
    ]);

    expect(getCachedRowsEntry(cache, 'first')?.rows[0]?.id).toBe('row-first');

    expect([...cache.keys()]).toEqual(['second', 'first']);
  });

  it('evicts the oldest row page when the cache grows past the limit', () => {
    const cache: RowsCache = new Map();
    for (let index = 0; index < 50; index += 1) {
      setCachedRowsEntry(cache, `key-${index}`, rowsResponse(`row-${index}`));
    }

    setCachedRowsEntry(cache, 'key-50', rowsResponse('row-50'));

    expect(cache.has('key-0')).toBe(false);
    expect(cache.has('key-50')).toBe(true);
    expect(cache.size).toBe(50);
  });

  it('prefetches the next non-active rows page when more rows exist', async () => {
    vi.mocked(fetchImportJobRows).mockResolvedValue(rowsResponse('row-next'));
    const cache: RowsCache = new Map();

    await prefetchRowsPage(cache, 'job-1', 'preview_ready', 'all', 1, 25, 51);

    expect(fetchImportJobRows).toHaveBeenCalledWith('job-1', 2, 'all');
    expect(cache.get('job-1:all:2')?.rows[0]?.id).toBe('row-next');
  });

  it('does not prefetch active jobs or already cached pages', async () => {
    const cache: RowsCache = new Map([
      ['job-1:all:2', rowsResponse('existing')],
    ]);

    await prefetchRowsPage(cache, 'job-1', 'validating', 'all', 1, 25, 51);
    await prefetchRowsPage(cache, 'job-1', 'preview_ready', 'all', 1, 25, 51);

    expect(fetchImportJobRows).not.toHaveBeenCalled();
    expect(cache.get('job-1:all:2')?.rows[0]?.id).toBe('existing');
  });
});
