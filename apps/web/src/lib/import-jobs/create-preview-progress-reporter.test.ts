import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPreviewProgressReporter } from './create-preview-progress-reporter';
import type { ImportJobRecord } from './import-job-service';

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

function createJob(overrides: Partial<ImportJobRecord> = {}): ImportJobRecord {
  return {
    id: 'job-1',
    merchant_id: 'merchant-1',
    created_by: 'user-1',
    source_platform: 'bumpa',
    entity_type: 'orders',
    status: 'validating',
    original_filename: 'orders.csv',
    storage_path: 'merchant-1/orders/orders.csv',
    content_type: 'text/csv',
    file_size_bytes: 1024,
    total_rows: 0,
    processed_rows: 0,
    summary: null,
    error: null,
    created_at: '2026-03-26T08:00:00.000Z',
    ...overrides,
  };
}

describe('createPreviewProgressReporter', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('throttles intermediate progress writes but persists final progress', async () => {
    vi.useFakeTimers();
    // All calls within 500ms time window
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(50)
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(150);

    const { from, updateQuery } = createSupabase();
    const logger = { error: vi.fn() };
    const reportProgress = createPreviewProgressReporter(
      { from } as unknown as SupabaseClient,
      createJob(),
      logger
    );

    // totalRows=1000: adaptive step = max(10, floor(1000/20)) = 50
    // Row 0: first report with totalRows → persisted (early progress)
    // Row 10: early progress (<=5 already passed), not enough step → throttled
    // Row 20: same → throttled
    // Row 1000: final → persisted
    await reportProgress({ processedRows: 0, totalRows: 1000 });
    await reportProgress({ processedRows: 10, totalRows: 1000 });
    await reportProgress({ processedRows: 20, totalRows: 1000 });
    await reportProgress({ processedRows: 1000, totalRows: 1000 });

    expect(updateQuery.update).toHaveBeenCalledWith({
      processed_rows: 0,
      total_rows: 1000,
    });
    expect(updateQuery.update).toHaveBeenCalledWith({
      processed_rows: 1000,
      total_rows: 1000,
    });
    expect(updateQuery.update).not.toHaveBeenCalledWith({
      processed_rows: 10,
      total_rows: 1000,
    });
    expect(updateQuery.update).not.toHaveBeenCalledWith({
      processed_rows: 20,
      total_rows: 1000,
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('uses adaptive step based on totalRows, targeting ~20 writes for large files', async () => {
    vi.useFakeTimers();
    // Simulate fast processing: all timestamps close together
    vi.spyOn(Date, 'now').mockReturnValue(0);

    const { from, updateQuery } = createSupabase();
    const logger = { error: vi.fn() };
    const reportProgress = createPreviewProgressReporter(
      { from } as unknown as SupabaseClient,
      createJob(),
      logger
    );

    const totalRows = 5822;
    const step = 291; // max(10, floor(5822/20))

    // Exercise boundaries instead of iterating every row:
    // 1. First report (totalRows becomes known) — persisted
    await reportProgress({ processedRows: 0, totalRows });
    // 2. Early progress (1-5) — each persisted
    for (let i = 1; i <= 5; i++) {
      await reportProgress({ processedRows: i, totalRows });
    }
    // 3. Sub-step intermediate — throttled
    await reportProgress({ processedRows: 6, totalRows });
    await reportProgress({ processedRows: 100, totalRows });
    // 4. Step boundaries — persisted
    for (let i = step; i < totalRows; i += step) {
      await reportProgress({ processedRows: i, totalRows });
    }
    // 5. Just below a step boundary — throttled
    await reportProgress({ processedRows: step * 2 + 1, totalRows });
    // 6. Final — persisted
    await reportProgress({ processedRows: totalRows, totalRows });

    // Expected persisted writes:
    //   1 (row 0) + 5 (early 1-5) + 19 (step boundaries: 291..5529) + 1 (final 5822) = 26
    // Rows 6, 100, and step*2+1 should be throttled
    expect(updateQuery.update).toHaveBeenCalledTimes(26);
    expect(updateQuery.update).not.toHaveBeenCalledWith({
      processed_rows: 6,
      total_rows: totalRows,
    });
    expect(updateQuery.update).not.toHaveBeenCalledWith({
      processed_rows: 100,
      total_rows: totalRows,
    });
    expect(updateQuery.update).toHaveBeenCalledWith({
      processed_rows: totalRows,
      total_rows: totalRows,
    });
  });

  it('floors adaptive step at 10 for small files', async () => {
    vi.useFakeTimers();
    vi.spyOn(Date, 'now').mockReturnValue(0);

    const { from, updateQuery } = createSupabase();
    const logger = { error: vi.fn() };
    const reportProgress = createPreviewProgressReporter(
      { from } as unknown as SupabaseClient,
      createJob(),
      logger
    );

    const totalRows = 100;
    // Expected adaptive step: max(10, floor(100/20)) = 10
    for (let i = 0; i <= totalRows; i++) {
      await reportProgress({ processedRows: i, totalRows });
    }

    // With step=10 for 100 rows: ~10 step-based writes + early progress + final
    const writeCount = updateQuery.update.mock.calls.length;
    expect(writeCount).toBeLessThanOrEqual(20);
    expect(writeCount).toBeGreaterThanOrEqual(8);
  });

  it('always persists the first report when totalRows becomes known', async () => {
    vi.useFakeTimers();
    vi.spyOn(Date, 'now').mockReturnValue(0);

    const { from, updateQuery } = createSupabase();
    const logger = { error: vi.fn() };
    const reportProgress = createPreviewProgressReporter(
      { from } as unknown as SupabaseClient,
      createJob(),
      logger
    );

    await reportProgress({ processedRows: 0, totalRows: 5000 });

    expect(updateQuery.update).toHaveBeenCalledWith({
      processed_rows: 0,
      total_rows: 5000,
    });
  });

  it('uses 500ms minimum time gap instead of 1000ms', async () => {
    vi.useFakeTimers();
    const nowMock = vi.spyOn(Date, 'now');
    // First call at t=0 (early progress, will persist)
    nowMock.mockReturnValueOnce(0);
    // Second call at t=600ms (past 500ms gap, should persist)
    nowMock.mockReturnValueOnce(600);

    const { from, updateQuery } = createSupabase();
    const logger = { error: vi.fn() };
    const reportProgress = createPreviewProgressReporter(
      { from } as unknown as SupabaseClient,
      createJob(),
      logger
    );

    // First call: early progress persists
    await reportProgress({ processedRows: 1, totalRows: 5000 });
    // Second call at t=600ms: should persist because 600 > 500ms gap
    await reportProgress({ processedRows: 7, totalRows: 5000 });

    expect(updateQuery.update).toHaveBeenCalledWith({
      processed_rows: 7,
      total_rows: 5000,
    });
  });

  it('logs and continues when persisting progress fails', async () => {
    const { from } = createSupabase({ message: 'boom-progress' });
    const logger = { error: vi.fn() };
    const reportProgress = createPreviewProgressReporter(
      { from } as unknown as SupabaseClient,
      createJob(),
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
