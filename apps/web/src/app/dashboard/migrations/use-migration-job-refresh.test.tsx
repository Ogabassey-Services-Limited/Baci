import { act, renderHook, waitFor } from '@testing-library/react';
import { useEffect, useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ImportJobDetail,
  ImportJobListItem,
  ImportJobRowsResponse,
} from '@/app/dashboard/migrations/migration-types';
import { useMigrationJobRefresh } from '@/app/dashboard/migrations/use-migration-job-refresh';

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
  jobOverrides: Partial<ImportJobListItem> = {},
  detailOverrides: Partial<ImportJobDetail> = {}
): ImportJobDetail {
  return {
    ...createJob(id, status, jobOverrides),
    canCommit: false,
    canNotify: false,
    ...detailOverrides,
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

function useRefreshHarness({
  activeFilter = 'all',
  initialJob,
}: {
  activeFilter?: 'all' | 'importable' | 'needs_fix';
  initialJob: ImportJobDetail;
}) {
  const [jobs, setJobs] = useState<ImportJobListItem[]>([initialJob]);
  const [selectedJob, setSelectedJob] = useState<ImportJobDetail | null>(
    initialJob
  );
  const [rowsResponse, setRowsResponse] =
    useState<ImportJobRowsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedJobIdRef = useRef<string | null>(initialJob.id);
  const selectedJobRef = useRef<ImportJobDetail | null>(selectedJob);

  useEffect(() => {
    selectedJobRef.current = selectedJob;
  }, [selectedJob]);

  const refreshState = useMigrationJobRefresh({
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

  return {
    error,
    jobs,
    loading,
    refreshState,
    rowsLoading,
    rowsResponse,
    selectedJob,
  };
}

describe('useMigrationJobRefresh', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('reuses cached rows for non-active jobs instead of refetching the same page', async () => {
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
      useRefreshHarness({
        initialJob: createJobDetail('job-cache', 'preview_ready'),
      })
    );

    await act(async () => {
      await result.current.refreshState.refreshJob('job-cache', {
        includeJob: false,
        includeRows: true,
        page: 1,
      });
    });

    expect(result.current.rowsResponse?.rows[0]?.id).toBe('row-a');
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refreshState.refreshJob('job-cache', {
        includeJob: false,
        includeRows: true,
        page: 1,
      });
    });

    expect(result.current.rowsResponse?.rows[0]?.id).toBe('row-a');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('loads persisted rows for validating jobs once the detail refresh exposes progress', async () => {
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);

      if (url === '/api/import-jobs/job-validating') {
        return Promise.resolve(
          createJsonResponse({
            job: createJobDetail('job-validating', 'validating', {
              processed_rows: 25,
              total_rows: 100,
            }),
          })
        );
      }

      if (
        url ===
        '/api/import-jobs/job-validating/rows?filter=all&page=1&pageSize=25'
      ) {
        return Promise.resolve(
          createJsonResponse(createRowsResponse('row-25'))
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const { result } = renderHook(() =>
      useRefreshHarness({
        initialJob: createJobDetail('job-validating', 'validating'),
      })
    );

    await act(async () => {
      await result.current.refreshState.refreshJob('job-validating');
    });

    expect(result.current.selectedJob?.processed_rows).toBe(25);
    expect(result.current.rowsResponse?.rows[0]?.id).toBe('row-25');
  });

  it('suppresses background refresh errors', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Rows fetch failed'));

    const { result } = renderHook(() =>
      useRefreshHarness({
        initialJob: createJobDetail('job-bg', 'preview_ready'),
      })
    );

    await act(async () => {
      await result.current.refreshState.refreshJob('job-bg', {
        background: true,
        includeJob: false,
        includeRows: true,
      });
    });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.rowsResponse).toBeNull();
    });
  });
});
