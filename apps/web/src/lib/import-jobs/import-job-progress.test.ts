import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { ImportJobRecord } from '@/lib/import-jobs/import-job-service';
import { createImportJobSummaryProgressReporter } from './import-job-progress';

function createJob(summary: Record<string, unknown> | null): ImportJobRecord {
  return {
    id: 'job-1',
    merchant_id: 'merchant-1',
    created_by: 'user-1',
    source_platform: 'bumpa',
    entity_type: 'orders',
    status: 'committing',
    original_filename: 'orders.csv',
    storage_path: 'orders.csv',
    content_type: 'text/csv',
    file_size_bytes: 100,
    total_rows: 10,
    processed_rows: 10,
    summary,
    error: null,
    created_at: '2026-03-22T10:00:00.000Z',
  };
}

function createSupabaseMock(response: { error: unknown } = { error: null }) {
  const query = {
    eq: vi.fn(),
    update: vi.fn(),
  };
  query.update.mockReturnValue(query);
  query.eq.mockResolvedValue(response);

  return {
    supabase: {
      from: vi.fn(() => query),
    } as unknown as SupabaseClient,
    query,
  };
}

describe('createImportJobSummaryProgressReporter', () => {
  it('persists stage progress in the job summary without dropping existing keys', async () => {
    const { query, supabase } = createSupabaseMock();
    const reporter = createImportJobSummaryProgressReporter({
      job: createJob({ validRows: 10 }),
      logger: { error: vi.fn() },
      minUpdateMs: 0,
      processedKey: 'commitProcessedRecords',
      supabase,
      totalKey: 'commitTotalRecords',
    });

    await reporter.report({ processed: 2, total: 10 });
    await reporter.report({ processed: 10, total: 10 });

    expect(query.update).toHaveBeenNthCalledWith(1, {
      summary: {
        commitProcessedRecords: 2,
        commitTotalRecords: 10,
        validRows: 10,
      },
    });
    expect(reporter.getSummary()).toEqual({
      commitProcessedRecords: 10,
      commitTotalRecords: 10,
      validRows: 10,
    });
  });

  it('logs progress persistence failures without throwing', async () => {
    const logger = { error: vi.fn() };
    const { supabase } = createSupabaseMock({
      error: { message: 'database unavailable' },
    });
    const reporter = createImportJobSummaryProgressReporter({
      job: createJob(null),
      logger,
      minUpdateMs: 0,
      processedKey: 'notificationProcessedRecipients',
      supabase,
      totalKey: 'notificationTotalRecipients',
    });

    await expect(
      reporter.report({
        extra: { notificationSentCount: 1 },
        processed: 1,
        total: 2,
      })
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job-1',
        summary: {
          notificationProcessedRecipients: 1,
          notificationSentCount: 1,
          notificationTotalRecipients: 2,
        },
      })
    );
  });
});
