import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImportJobDetail } from '@/app/dashboard/migrations/migration-types';
import { useMigrationJobPolling } from '@/app/dashboard/migrations/use-migration-job-polling';

function createJob(status: ImportJobDetail['status']): ImportJobDetail {
  return {
    id: 'job-1',
    entity_type: 'orders',
    source_platform: 'bumpa',
    status,
    original_filename: 'orders.csv',
    processed_rows: 10,
    total_rows: 100,
    summary: null,
    error: null,
    created_at: '2026-03-26T10:00:00.000Z',
    committed_at: null,
    notified_at: null,
    canCommit: false,
    canNotify: false,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

describe('useMigrationJobPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not overlap polling when selected job object changes mid-poll', async () => {
    const firstRefresh = createDeferred<boolean>();
    const refreshJob = vi.fn().mockReturnValue(firstRefresh.promise);

    const { rerender } = renderHook(
      ({ selectedJob }: { selectedJob: ImportJobDetail | null }) =>
        useMigrationJobPolling({
          activeFilter: 'all',
          refreshJob,
          rowsResponse: {
            rows: [],
            pagination: { page: 1, pageSize: 25, total: 0 },
          },
          selectedJob,
          selectedJobId: 'job-1',
        }),
      {
        initialProps: { selectedJob: createJob('committing') },
      }
    );

    await act(async () => {
      vi.advanceTimersByTime(2500);
      await Promise.resolve();
    });

    expect(refreshJob).toHaveBeenCalledTimes(1);

    rerender({
      selectedJob: {
        ...createJob('committing'),
        processed_rows: 20,
      },
    });

    await act(async () => {
      vi.advanceTimersByTime(2500);
      await Promise.resolve();
    });

    expect(refreshJob).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstRefresh.resolve(true);
      await Promise.resolve();
    });
  });
});
