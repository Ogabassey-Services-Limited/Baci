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
    // Commit-flow tests start from persisted preview rows, so preview building
    // is intentionally bypassed here and asserted via the rows query instead.
    buildImportPreviewForJob: vi.fn(),
    buildImportPreviewChunksForJob: vi.fn(),
    buildImportJobRowInserts: vi.fn(),
  };
});

import { commitBumpaOrders } from '@/lib/import-commit/commit-bumpa-orders';
import { commitBumpaProducts } from '@/lib/import-commit/commit-bumpa-products';
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

function createRowsQuery(payload: Record<string, unknown>) {
  const rowsQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    not: vi.fn(),
    order: vi.fn(),
  };
  rowsQuery.select.mockReturnValue(rowsQuery);
  rowsQuery.eq.mockReturnValue(rowsQuery);
  rowsQuery.in.mockReturnValue(rowsQuery);
  rowsQuery.not.mockReturnValue(rowsQuery);
  rowsQuery.order.mockResolvedValue({
    data: [{ normalized_payload: payload }],
    error: null,
  });

  return rowsQuery;
}

function createUpdateQuery() {
  const updateQuery = {
    update: vi.fn(),
    eq: vi.fn(),
  };
  updateQuery.update.mockReturnValue(updateQuery);
  updateQuery.eq.mockResolvedValue({ error: null });
  return updateQuery;
}

describe('runClaimedImportJob commit flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('commits normalized rows and merges commit summary data', async () => {
    vi.mocked(commitBumpaOrders).mockResolvedValue({
      createdOrders: 1,
      updatedOrders: 0,
      createdCustomers: 1,
    });

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(
          createRowsQuery({
            externalSourceId: 'order-1',
            customer: {},
            items: [],
          })
        )
        .mockReturnValueOnce(createUpdateQuery()),
    } as unknown as SupabaseClient;

    const result = await runClaimedImportJob(supabase, createJob('committing'));

    expect(result).toEqual({
      id: 'committing-job',
      status: 'committed',
      processed: 1,
    });
    expect(commitBumpaOrders).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: 'merchant-1',
        importJobId: 'committing-job',
      })
    );
  });

  it('routes product commits through the product importer', async () => {
    vi.mocked(commitBumpaProducts).mockResolvedValue({
      createdProducts: 1,
      updatedProducts: 0,
    });

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(
          createRowsQuery({
            externalSourceId: 'product-1',
            title: 'Phone',
            price: 1000,
          })
        )
        .mockReturnValueOnce(createUpdateQuery()),
    } as unknown as SupabaseClient;

    const result = await runClaimedImportJob(supabase, {
      ...createJob('committing'),
      entity_type: 'products',
    });

    expect(result).toEqual({
      id: 'committing-job',
      status: 'committed',
      processed: 1,
    });
    expect(commitBumpaProducts).toHaveBeenCalledTimes(1);
  });

  it('surfaces order commit failures', async () => {
    vi.mocked(commitBumpaOrders).mockRejectedValueOnce(
      new Error('order commit failed')
    );

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(
          createRowsQuery({
            externalSourceId: 'order-1',
            customer: {},
            items: [],
          })
        )
        .mockReturnValueOnce(createUpdateQuery()),
    } as unknown as SupabaseClient;

    const result = await runClaimedImportJob(supabase, createJob('committing'));

    expect(result).toMatchObject({
      status: 'failed',
      error: 'order commit failed',
    });
  });

  it('surfaces product commit failures', async () => {
    vi.mocked(commitBumpaProducts).mockRejectedValueOnce(
      new Error('product commit failed')
    );

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(
          createRowsQuery({
            externalSourceId: 'product-1',
            title: 'Phone',
            price: 1000,
          })
        )
        .mockReturnValueOnce(createUpdateQuery()),
    } as unknown as SupabaseClient;

    const result = await runClaimedImportJob(supabase, {
      ...createJob('committing'),
      entity_type: 'products',
    });

    expect(result).toMatchObject({
      status: 'failed',
      error: 'product commit failed',
    });
  });
});
