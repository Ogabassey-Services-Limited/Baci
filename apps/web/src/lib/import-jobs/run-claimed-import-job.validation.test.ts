import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/import-commit/commit-bumpa-orders', () => ({
  commitBumpaOrders: vi.fn(),
}));

vi.mock('@/lib/import-commit/commit-bumpa-products', () => ({
  commitBumpaProducts: vi.fn(),
}));

vi.mock('@/lib/import-notifications/send-import-notification-campaign', () => ({
  sendImportNotificationCampaign: vi.fn(),
}));

vi.mock('./import-job-service', async () => {
  const actual = await vi.importActual<typeof import('./import-job-service')>(
    './import-job-service'
  );

  return {
    ...actual,
    buildImportPreviewForJob: vi.fn(),
    buildImportJobRowInserts: vi.fn(),
  };
});

import { sendImportNotificationCampaign } from '@/lib/import-notifications/send-import-notification-campaign';
import {
  buildImportJobRowInserts,
  buildImportPreviewForJob,
} from './import-job-service';
import { runClaimedImportJob } from './run-claimed-import-job';

function createJob(status: 'validating' | 'committing' | 'notifying') {
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

describe('runClaimedImportJob validation and notification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists preview rows and marks validating jobs as preview_ready', async () => {
    vi.mocked(buildImportPreviewForJob).mockResolvedValue({
      sourceRows: [{ id: 'order-1' }],
      rows: [
        {
          rowNumber: 2,
          sourceExternalId: 'order-1',
          rowStatus: 'create',
          errors: [],
          payload: null,
          meta: {},
        },
      ],
      summary: { validRows: 1 },
      totalRows: 1,
    } as never);
    vi.mocked(buildImportJobRowInserts).mockReturnValue([
      {
        import_job_id: 'validating-job',
        merchant_id: 'merchant-1',
        row_number: 2,
        source_external_id: 'order-1',
        row_status: 'create',
        source_payload: { id: 'order-1' },
        normalized_payload: null,
        validation_errors: [],
        meta: {},
      },
    ]);

    const deleteQuery = {
      delete: vi.fn(),
      eq: vi.fn(),
    };
    deleteQuery.delete.mockReturnValue(deleteQuery);
    deleteQuery.eq.mockResolvedValue({ error: null });

    const insertQuery = {
      insert: vi.fn(),
    };
    insertQuery.insert.mockResolvedValue({ error: null });

    const updateQuery = {
      update: vi.fn(),
      eq: vi.fn(),
    };
    updateQuery.update.mockReturnValue(updateQuery);
    updateQuery.eq.mockResolvedValue({ error: null });

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(deleteQuery)
        .mockReturnValueOnce(insertQuery)
        .mockReturnValueOnce(updateQuery),
    } as unknown as SupabaseClient;

    const result = await runClaimedImportJob(supabase, createJob('validating'));

    expect(result).toEqual({
      id: 'validating-job',
      status: 'preview_ready',
      processed: 1,
    });
    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ source_external_id: 'order-1' }),
      ])
    );
  });

  it('persists live validation progress while preview rows are being built', async () => {
    vi.mocked(buildImportPreviewForJob).mockImplementation(
      async (_supabase, _job, onProgress) => {
        await onProgress?.({ processedRows: 0, totalRows: 2 });
        await onProgress?.({ processedRows: 1, totalRows: 2 });

        return {
          sourceRows: [{ id: 'order-1' }, { id: 'order-2' }],
          rows: [
            {
              rowNumber: 2,
              sourceExternalId: 'order-1',
              rowStatus: 'create',
              errors: [],
              payload: null,
              meta: {},
            },
            {
              rowNumber: 3,
              sourceExternalId: 'order-2',
              rowStatus: 'create',
              errors: [],
              payload: null,
              meta: {},
            },
          ],
          summary: { validRows: 2 },
          totalRows: 2,
        } as never;
      }
    );
    vi.mocked(buildImportJobRowInserts).mockReturnValue([
      {
        import_job_id: 'validating-job',
        merchant_id: 'merchant-1',
        row_number: 2,
        source_external_id: 'order-1',
        row_status: 'create',
        source_payload: { id: 'order-1' },
        normalized_payload: null,
        validation_errors: [],
        meta: {},
      },
      {
        import_job_id: 'validating-job',
        merchant_id: 'merchant-1',
        row_number: 3,
        source_external_id: 'order-2',
        row_status: 'create',
        source_payload: { id: 'order-2' },
        normalized_payload: null,
        validation_errors: [],
        meta: {},
      },
    ]);

    const deleteQuery = {
      delete: vi.fn(),
      eq: vi.fn(),
    };
    deleteQuery.delete.mockReturnValue(deleteQuery);
    deleteQuery.eq.mockResolvedValue({ error: null });

    const insertQuery = {
      insert: vi.fn(),
    };
    insertQuery.insert.mockResolvedValue({ error: null });

    const updateQuery = {
      update: vi.fn(),
      eq: vi.fn(),
    };
    updateQuery.update.mockReturnValue(updateQuery);
    updateQuery.eq.mockResolvedValue({ error: null });

    let importJobRowsCallCount = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'import_job_rows') {
          importJobRowsCallCount += 1;
          return importJobRowsCallCount === 1 ? deleteQuery : insertQuery;
        }

        return updateQuery;
      }),
    } as unknown as SupabaseClient;

    await runClaimedImportJob(supabase, createJob('validating'));

    expect(updateQuery.update).toHaveBeenCalledWith({
      processed_rows: 0,
      total_rows: 2,
    });
    expect(updateQuery.update).toHaveBeenCalledWith({
      processed_rows: 1,
      total_rows: 2,
    });
    expect(updateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'preview_ready',
        processed_rows: 2,
        total_rows: 2,
      })
    );
  });

  it('throttles validation progress writes for larger jobs', async () => {
    vi.useFakeTimers();
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(200)
      .mockReturnValueOnce(1300);

    vi.mocked(buildImportPreviewForJob).mockImplementation(
      async (_supabase, _job, onProgress) => {
        await onProgress?.({ processedRows: 0, totalRows: 100 });
        await onProgress?.({ processedRows: 10, totalRows: 100 });
        await onProgress?.({ processedRows: 20, totalRows: 100 });
        await onProgress?.({ processedRows: 100, totalRows: 100 });

        return {
          sourceRows: Array.from({ length: 100 }, (_, index) => ({
            id: `order-${index + 1}`,
          })),
          rows: [],
          summary: { validRows: 0 },
          totalRows: 100,
        } as never;
      }
    );
    vi.mocked(buildImportJobRowInserts).mockReturnValue([]);

    const deleteQuery = {
      delete: vi.fn(),
      eq: vi.fn(),
    };
    deleteQuery.delete.mockReturnValue(deleteQuery);
    deleteQuery.eq.mockResolvedValue({ error: null });

    const updateQuery = {
      update: vi.fn(),
      eq: vi.fn(),
    };
    updateQuery.update.mockReturnValue(updateQuery);
    updateQuery.eq.mockResolvedValue({ error: null });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'import_job_rows') {
          return deleteQuery;
        }

        return updateQuery;
      }),
    } as unknown as SupabaseClient;

    await runClaimedImportJob(supabase, createJob('validating'));

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

    vi.useRealTimers();
  });

  it('sends merchant notifications and completes notifying jobs', async () => {
    vi.mocked(sendImportNotificationCampaign).mockResolvedValue({
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
    expect(sendImportNotificationCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        importJobId: 'notifying-job',
      })
    );
  });

  it('marks the job as failed when execution throws', async () => {
    vi.mocked(buildImportPreviewForJob).mockRejectedValue(
      new Error('Preview failed')
    );

    const failureUpdateQuery = {
      update: vi.fn(),
      eq: vi.fn(),
    };
    failureUpdateQuery.update.mockReturnValue(failureUpdateQuery);
    failureUpdateQuery.eq.mockResolvedValue({ error: null });

    const supabase = {
      from: vi.fn().mockReturnValueOnce(failureUpdateQuery),
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
