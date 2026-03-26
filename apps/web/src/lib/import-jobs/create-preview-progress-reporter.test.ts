import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPreviewProgressReporter } from './create-preview-progress-reporter';

function createSupabase(progressError: unknown = null) {
  const updateQuery = {
    update: vi.fn(),
    eq: vi.fn(),
  };
  updateQuery.update.mockReturnValue(updateQuery);
  updateQuery.eq.mockResolvedValue({ error: progressError });

  return {
    from: vi.fn(() => updateQuery),
    updateQuery,
  };
}

describe('createPreviewProgressReporter', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('throttles intermediate progress writes but persists final progress', async () => {
    vi.useFakeTimers();
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(200)
      .mockReturnValueOnce(1300);

    const { from, updateQuery } = createSupabase();
    const logger = { error: vi.fn() };
    const reportProgress = createPreviewProgressReporter(
      { from } as unknown as SupabaseClient,
      { id: 'job-1' } as { id: string },
      logger
    );

    await reportProgress({ processedRows: 0, totalRows: 100 });
    await reportProgress({ processedRows: 10, totalRows: 100 });
    await reportProgress({ processedRows: 20, totalRows: 100 });
    await reportProgress({ processedRows: 100, totalRows: 100 });

    expect(updateQuery.update).toHaveBeenCalledWith({
      processed_rows: 0,
      total_rows: 100,
    });
    expect(updateQuery.update).toHaveBeenCalledWith({
      processed_rows: 100,
      total_rows: 100,
    });
    expect(updateQuery.update).not.toHaveBeenCalledWith({
      processed_rows: 10,
      total_rows: 100,
    });
    expect(updateQuery.update).not.toHaveBeenCalledWith({
      processed_rows: 20,
      total_rows: 100,
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs and continues when persisting progress fails', async () => {
    const { from } = createSupabase({ message: 'boom-progress' });
    const logger = { error: vi.fn() };
    const reportProgress = createPreviewProgressReporter(
      { from } as unknown as SupabaseClient,
      { id: 'job-1' } as { id: string },
      logger
    );

    await reportProgress({ processedRows: 1, totalRows: 2 });

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to update import preview progress',
        jobId: 'job-1',
        processedRows: 1,
        totalRows: 2,
      })
    );
  });
});
