import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFailingChunkGenerator } from '@/lib/import-jobs/import-job-test-helpers';

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
    sendImportNotificationCampaignMock.mockImplementation(
      async ({ onProgress }) => {
        await onProgress?.({
          failedCount: 0,
          processedRecipients: 4,
          sentCount: 3,
          skippedCount: 1,
          totalRecipients: 4,
        });
        return {
          sentCount: 3,
          skippedCount: 1,
          failedCount: 0,
          notificationProcessedRecipients: 4,
          notificationTotalRecipients: 4,
        };
      }
    );

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
        support_email: 'support@ogabassey.com',
        email_sender_name: 'Ogabassey',
        email: 'hello@ogabassey.com',
        brand_colors: { primary: '#d71920' },
      },
      error: null,
    });

    const domainQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    domainQuery.select.mockReturnValue(domainQuery);
    domainQuery.eq.mockReturnValue(domainQuery);
    domainQuery.maybeSingle.mockResolvedValue({
      data: {
        domain: 'ogabassey.com',
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

    const progressUpdateQuery = {
      update: vi.fn(),
      eq: vi.fn(),
    };
    progressUpdateQuery.update.mockReturnValue(progressUpdateQuery);
    progressUpdateQuery.eq.mockResolvedValue({ error: null });

    const finalUpdateQuery = {
      update: vi.fn(),
      eq: vi.fn(),
    };
    finalUpdateQuery.update.mockReturnValue(finalUpdateQuery);
    finalUpdateQuery.eq.mockResolvedValue({ error: null });

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(merchantQuery)
        .mockReturnValueOnce(domainQuery)
        .mockReturnValueOnce(featureQuery)
        .mockReturnValueOnce(progressUpdateQuery)
        .mockReturnValueOnce(finalUpdateQuery),
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
        merchant: expect.objectContaining({
          custom_domain: 'ogabassey.com',
        }),
      })
    );
    expect(merchantQuery.select).toHaveBeenCalledWith(
      'id, slug, business_name, support_email, email_sender_name, email, brand_colors, logo_url, email_logo_url'
    );
    expect(progressUpdateQuery.update).toHaveBeenCalledWith({
      summary: {
        notificationProcessedRecipients: 4,
        notificationTotalRecipients: 4,
        validRows: 1,
      },
    });
    expect(finalUpdateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        summary: expect.objectContaining({
          notificationProcessedRecipients: 4,
          notificationTotalRecipients: 4,
          sentCount: 3,
        }),
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
