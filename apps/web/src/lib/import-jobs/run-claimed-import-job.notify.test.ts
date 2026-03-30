import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PreviewBuildChunk } from '@/lib/import-jobs/import-job-service';

const {
  buildImportPreviewChunksForJobMock,
  sendImportNotificationCampaignMock,
} = vi.hoisted(() => ({
  buildImportPreviewChunksForJobMock: vi.fn(),
  sendImportNotificationCampaignMock: vi.fn(),
}));

vi.mock('@/lib/import-commit/commit-bumpa-orders', () => ({
  commitBumpaOrders: vi.fn(),
}));

vi.mock('@/lib/import-commit/commit-bumpa-products', () => ({
  commitBumpaProducts: vi.fn(),
}));

vi.mock('@/lib/import-notifications/send-import-notification-campaign', () => ({
  sendImportNotificationCampaign: sendImportNotificationCampaignMock,
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}));

vi.mock('@/lib/import-jobs/import-job-service', () => ({
  buildImportPreviewChunksForJob: buildImportPreviewChunksForJobMock,
  buildImportPreviewForJob: vi.fn(),
  buildImportJobRowInserts: vi.fn(),
  mergeImportJobSummary: vi.fn((_current, summary) => summary),
}));

import { runClaimedImportJob } from '@/lib/import-jobs/run-claimed-import-job';

function createFailingChunkGenerator(
  message: string
): AsyncGenerator<PreviewBuildChunk> {
  const iterator = {
    async next() {
      await Promise.resolve();
      throw new Error(message);
    },
    return(value?: unknown) {
      return Promise.resolve({
        done: true as const,
        value: value as PreviewBuildChunk,
      });
    },
    throw(error?: unknown) {
      return Promise.reject(error);
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };

  return iterator as unknown as AsyncGenerator<PreviewBuildChunk>;
}

function createJob(status: 'validating' | 'notifying') {
  return {
    id: `${status}-job`,
    merchant_id: 'merchant-1',
    created_by: 'user-1',
    source_platform: 'bumpa' as const,
    entity_type: 'orders' as const,
    status,
    original_filename: `${status}.csv`,
    storage_path: `${status}.csv`,
    content_type: 'text/csv',
    file_size_bytes: 100,
    total_rows: 1,
    processed_rows: 0,
    summary: { validRows: 1 },
    error: null,
    created_at: '2026-03-22T10:00:00.000Z',
  };
}

describe('runClaimedImportJob notification and failure flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends merchant notifications and completes notifying jobs', async () => {
    sendImportNotificationCampaignMock.mockResolvedValue({
      sentCount: 3,
      skippedCount: 1,
      failedCount: 0,
    });

    const merchantQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(),
    };
    merchantQuery.select.mockReturnValue(merchantQuery);
    merchantQuery.eq.mockReturnValue(merchantQuery);
    merchantQuery.single.mockResolvedValue({
      data: {
        id: 'merchant-1',
        slug: 'ogabassey',
        business_name: 'Ogabassey',
        custom_domain: null,
        support_email: 'support@ogabassey.com',
        email_sender_name: 'Ogabassey',
        email: 'hello@ogabassey.com',
      },
      error: null,
    });

    const featureQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    featureQuery.select.mockReturnValue(featureQuery);
    featureQuery.eq.mockReturnValue(featureQuery);
    featureQuery.maybeSingle.mockResolvedValue({
      data: {
        custom_settings: { migration_imports: { receipt_access_mode: 'site' } },
      },
      error: null,
    });

    const updateQuery = {
      update: vi.fn(),
      eq: vi.fn(),
    };
    updateQuery.update.mockReturnValue(updateQuery);
    updateQuery.eq.mockResolvedValue({ error: null });

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(merchantQuery)
        .mockReturnValueOnce(featureQuery)
        .mockReturnValueOnce(updateQuery),
    } as unknown as SupabaseClient;

    const result = await runClaimedImportJob(supabase, createJob('notifying'));

    expect(result).toEqual({
      id: 'notifying-job',
      status: 'completed',
      processed: 3,
    });
    expect(sendImportNotificationCampaignMock).toHaveBeenCalledWith(
      expect.objectContaining({
        importJobId: 'notifying-job',
      })
    );
  });

  it('marks the job as failed when execution throws', async () => {
    buildImportPreviewChunksForJobMock.mockImplementation(() =>
      createFailingChunkGenerator('Preview failed')
    );

    const deleteQuery = {
      delete: vi.fn(),
      eq: vi.fn(),
    };
    deleteQuery.delete.mockReturnValue(deleteQuery);
    deleteQuery.eq.mockResolvedValue({ error: null });

    const failureUpdateQuery = {
      update: vi.fn(),
      eq: vi.fn(),
    };
    failureUpdateQuery.update.mockReturnValue(failureUpdateQuery);
    failureUpdateQuery.eq.mockResolvedValue({ error: null });

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(deleteQuery)
        .mockReturnValueOnce(failureUpdateQuery),
    } as unknown as SupabaseClient;

    const result = await runClaimedImportJob(supabase, createJob('validating'));

    expect(result).toEqual({
      id: 'validating-job',
      status: 'failed',
      processed: 0,
      error: 'Preview failed',
    });
    expect(failureUpdateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        error: 'Preview failed',
      })
    );
  });
});
