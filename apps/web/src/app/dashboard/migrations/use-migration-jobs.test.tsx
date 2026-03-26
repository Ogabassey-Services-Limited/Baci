import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMigrationJobs } from '@/app/dashboard/migrations/use-migration-jobs';

function createJsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  } as Response;
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
});
