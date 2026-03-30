import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ImportJobDetail,
  ImportJobListItem,
  ImportJobRowsResponse,
} from '@/app/dashboard/migrations/migration-types';
import { useMigrationJobs } from '@/app/dashboard/migrations/use-migration-jobs';

function createJsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  } as Response;
}

function createJob(
  id: string,
  status: ImportJobListItem['status'],
  overrides: Partial<ImportJobListItem> = {}
): ImportJobListItem {
  return {
    id,
    entity_type: 'orders',
    source_platform: 'bumpa',
    status,
    original_filename: `${id}.csv`,
    processed_rows: 0,
    total_rows: 0,
    summary: null,
    error: null,
    created_at: '2026-03-22T10:00:00.000Z',
    committed_at: null,
    notified_at: null,
    ...overrides,
  };
}

function createJobDetail(
  id: string,
  status: ImportJobDetail['status'],
  overrides: Partial<ImportJobDetail> = {}
): ImportJobDetail {
  return {
    ...createJob(id, status, overrides),
    canCommit: false,
    canNotify: false,
    ...overrides,
  };
}

function createRowsResponse(rowId: string, total = 1): ImportJobRowsResponse {
  return {
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
    pagination: { page: 1, pageSize: 25, total },
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

describe('useMigrationJobs', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('does not auto-select stale queued jobs when no previewable job exists', () => {
    const { result } = renderHook(() =>
      useMigrationJobs({
        initialJobs: [
          {
            id: 'job-queued',
            entity_type: 'orders',
            source_platform: 'bumpa',
            status: 'uploaded',
            original_filename: 'orders.csv',
            processed_rows: 0,
            total_rows: 0,
            summary: null,
            error: null,
            created_at: '2026-03-22T10:00:00.000Z',
            committed_at: null,
            notified_at: null,
          },
        ],
      })
    );

    expect(result.current.selectedJobId).toBeNull();
    expect(result.current.selectedJob).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('selects the first previewable job and fetches rows on mount', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      createJsonResponse({
        rows: [],
        pagination: { page: 1, pageSize: 25, total: 0 },
      })
    );

    const { result } = renderHook(() =>
      useMigrationJobs({
        initialJobs: [
          {
            id: 'job-stale',
            entity_type: 'orders',
            source_platform: 'bumpa',
            status: 'uploaded',
            original_filename: 'orders.csv',
            processed_rows: 0,
            total_rows: 0,
            summary: null,
            error: null,
            created_at: '2026-03-22T10:00:00.000Z',
            committed_at: null,
            notified_at: null,
          },
          {
            id: 'job-1',
            entity_type: 'orders',
            source_platform: 'bumpa',
            status: 'preview_ready',
            original_filename: 'orders.csv',
            processed_rows: 10,
            total_rows: 10,
            summary: { validRows: 8, invalidRows: 2, receiptReadyOrders: 3 },
            error: null,
            created_at: '2026-03-22T11:00:00.000Z',
            committed_at: null,
            notified_at: null,
          },
        ],
      })
    );

    expect(result.current.selectedJobId).toBe('job-1');
    expect(result.current.selectedJob?.id).toBe('job-1');

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/import-jobs/job-1/rows?filter=all&page=1&pageSize=25',
        { cache: 'no-store' }
      );
    });
  });

  it('does not overwrite the selected job when an older refresh resolves late', async () => {
    const initialRows = createRowsResponse('row-a');
    const staleDetailResponse = createDeferred<Response>();
    const staleRowsResponse = createDeferred<Response>();
    let jobARowsCalls = 0;

    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);

      if (url === '/api/import-jobs/job-a/rows?filter=all&page=1&pageSize=25') {
        jobARowsCalls += 1;
        return jobARowsCalls === 1
          ? Promise.resolve(createJsonResponse(initialRows))
          : staleRowsResponse.promise;
      }

      if (url === '/api/import-jobs/job-a') {
        return staleDetailResponse.promise;
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const { result } = renderHook(() =>
      useMigrationJobs({
        initialJobs: [
          createJob('job-a', 'preview_ready', {
            processed_rows: 1,
            total_rows: 1,
          }),
          createJob('job-b', 'uploaded'),
        ],
      })
    );

    await waitFor(() => {
      expect(result.current.rowsResponse?.rows[0]?.id).toBe('row-a');
    });

    let refreshPromise: Promise<boolean> | undefined;
    act(() => {
      refreshPromise = result.current.refreshJob('job-a');
      result.current.setSelectedJobId('job-b');
    });

    await waitFor(() => {
      expect(result.current.selectedJobId).toBe('job-b');
      expect(result.current.selectedJob?.id).toBe('job-b');
      expect(result.current.rowsResponse).toBeNull();
    });

    staleDetailResponse.resolve(
      createJsonResponse({
        job: createJobDetail('job-a', 'preview_ready', {
          processed_rows: 2,
          total_rows: 2,
        }),
      })
    );
    staleRowsResponse.resolve(
      createJsonResponse(createRowsResponse('row-stale'))
    );

    await act(async () => {
      await refreshPromise;
    });

    expect(result.current.selectedJobId).toBe('job-b');
    expect(result.current.selectedJob?.id).toBe('job-b');
    expect(result.current.rowsResponse).toBeNull();
  });

  it('evicts least-recently-used cached row pages once the cache exceeds the limit', async () => {
    vi.mocked(fetch).mockImplementation((input) => {
      const url = new URL(String(input), 'https://example.com');

      if (url.pathname !== '/api/import-jobs/job-cache/rows') {
        throw new Error(`Unexpected fetch: ${url.pathname}${url.search}`);
      }

      const page = Number(url.searchParams.get('page') || '1');
      return Promise.resolve(
        createJsonResponse(createRowsResponse(`row-${page}`, 2_000))
      );
    });

    const { result } = renderHook(() =>
      useMigrationJobs({
        initialJobs: [createJob('job-cache', 'preview_ready')],
      })
    );

    await waitFor(() => {
      expect(result.current.rowsResponse?.rows[0]?.id).toBe('row-1');
    });

    for (let page = 2; page <= 51; page += 1) {
      await act(async () => {
        await result.current.refreshJob('job-cache', {
          filter: 'all',
          includeJob: false,
          includeRows: true,
          page,
        });
      });
    }

    await act(async () => {
      await result.current.refreshJob('job-cache', {
        filter: 'all',
        includeJob: false,
        includeRows: true,
        page: 1,
      });
    });

    expect(result.current.rowsResponse).toEqual(
      createRowsResponse('row-1', 2_000)
    );
    expect(
      vi
        .mocked(fetch)
        .mock.calls.filter(
          ([input]) =>
            String(input) ===
            '/api/import-jobs/job-cache/rows?filter=all&page=1&pageSize=25'
        )
    ).toHaveLength(2);
  });

  it('clears foreground loading when a background refresh supersedes it', async () => {
    const detailResponse = createDeferred<Response>();

    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);

      if (url === '/api/import-jobs/job-c') {
        return detailResponse.promise;
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const { result } = renderHook(() =>
      useMigrationJobs({
        initialJobs: [],
      })
    );

    act(() => {
      void result.current.refreshJob('job-c', {
        includeRows: false,
      });
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      await result.current.refreshJob('job-c', {
        background: true,
        includeJob: false,
        includeRows: false,
      });
    });

    detailResponse.resolve(
      createJsonResponse({
        job: createJobDetail('job-c', 'uploaded'),
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('keeps the new job filter state when an old filter request finishes late', async () => {
    const initialRows = createRowsResponse('row-a');
    const filteredRowsResponse = createDeferred<Response>();

    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);

      if (url === '/api/import-jobs/job-a/rows?filter=all&page=1&pageSize=25') {
        return Promise.resolve(createJsonResponse(initialRows));
      }

      if (
        url ===
        '/api/import-jobs/job-a/rows?filter=needs_fix&page=1&pageSize=25'
      ) {
        return filteredRowsResponse.promise;
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const { result } = renderHook(() =>
      useMigrationJobs({
        initialJobs: [
          createJob('job-a', 'preview_ready'),
          createJob('job-b', 'uploaded'),
        ],
      })
    );

    await waitFor(() => {
      expect(result.current.rowsResponse?.rows[0]?.id).toBe('row-a');
    });

    let filterPromise: Promise<void> | undefined;
    act(() => {
      filterPromise = result.current.handleFilterChange('needs_fix');
      result.current.setSelectedJobId('job-b');
    });

    filteredRowsResponse.resolve(
      createJsonResponse(createRowsResponse('row-needs-fix'))
    );

    await act(async () => {
      await filterPromise;
    });

    expect(result.current.selectedJobId).toBe('job-b');
    expect(result.current.activeFilter).toBe('all');
    expect(result.current.rowsResponse).toBeNull();
  });

  it('does not surface a user-facing error when a background refresh fails', async () => {
    const initialRows = createRowsResponse('row-a');
    let firstRowsRequest = true;

    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);

      if (
        url === '/api/import-jobs/job-bg/rows?filter=all&page=1&pageSize=25'
      ) {
        if (firstRowsRequest) {
          firstRowsRequest = false;
          return Promise.resolve(createJsonResponse(initialRows));
        }

        return Promise.reject(new Error('Too many requests'));
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const { result } = renderHook(() =>
      useMigrationJobs({
        initialJobs: [createJob('job-bg', 'preview_ready')],
      })
    );

    await waitFor(() => {
      expect(result.current.rowsResponse?.rows[0]?.id).toBe('row-a');
    });

    await act(async () => {
      await result.current.refreshJob('job-bg', {
        background: true,
        includeJob: false,
        includeRows: true,
      });
    });

    expect(result.current.error).toBeNull();
    expect(result.current.rowsResponse?.rows[0]?.id).toBe('row-a');
  });

  it('loads partial rows for validating jobs once processed rows exist', async () => {
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);

      if (url === '/api/import-jobs/job-validating') {
        return Promise.resolve(
          createJsonResponse({
            job: createJobDetail('job-validating', 'validating', {
              processed_rows: 12,
              total_rows: 100,
              summary: { validRows: 9, invalidRows: 3 },
            }),
          })
        );
      }

      if (
        url ===
        '/api/import-jobs/job-validating/rows?filter=all&page=1&pageSize=25'
      ) {
        return Promise.resolve(
          createJsonResponse(createRowsResponse('row-12'))
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const { result } = renderHook(() =>
      useMigrationJobs({
        initialJobs: [createJob('job-validating', 'validating')],
      })
    );

    act(() => {
      result.current.setSelectedJobId('job-validating');
    });

    await waitFor(() => {
      expect(result.current.rowsResponse?.rows[0]?.id).toBe('row-12');
    });
  });

  it('reuses cached rows when revisiting the same preview page', async () => {
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);

      if (
        url === '/api/import-jobs/job-cache/rows?filter=all&page=1&pageSize=25'
      ) {
        return Promise.resolve(createJsonResponse(createRowsResponse('row-a')));
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const { result } = renderHook(() =>
      useMigrationJobs({
        initialJobs: [createJob('job-cache', 'preview_ready')],
      })
    );

    await waitFor(() => {
      expect(result.current.rowsResponse?.rows[0]?.id).toBe('row-a');
    });

    vi.mocked(fetch).mockClear();

    await act(async () => {
      await result.current.refreshJob('job-cache', {
        includeJob: false,
        includeRows: true,
        page: 1,
      });
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.rowsResponse?.rows[0]?.id).toBe('row-a');
  });
});
