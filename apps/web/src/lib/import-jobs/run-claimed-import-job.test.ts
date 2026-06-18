import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock all external dependencies before importing the module
vi.mock('@/lib/import-commit/commit-bumpa-orders', () => ({
  commitBumpaOrders: vi.fn().mockResolvedValue({
    createdOrders: 5,
    updatedOrders: 2,
    createdCustomers: 3,
  }),
}));

vi.mock('@/lib/import-commit/commit-bumpa-products', () => ({
  commitBumpaProducts: vi.fn().mockResolvedValue({
    createdProducts: 10,
    updatedProducts: 1,
  }),
}));

vi.mock('@/lib/import-notifications/send-import-notification-campaign', () => ({
  sendImportNotificationCampaign: vi.fn().mockResolvedValue({
    sentCount: 5,
    skippedCount: 0,
    failedCount: 0,
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}));

function createValidatingChunkGenerator() {
  return (async function* () {
    await Promise.resolve();
    yield {
      totalRows: 10,
      processedRows: 10,
      sourceRows: Array.from({ length: 10 }, () => ({})),
      rows: Array.from({ length: 10 }, (_, i) => ({
        rowNumber: i + 1,
        sourceExternalId: `ext-${i}`,
        rowStatus: 'create' as const,
        errors: [],
        payload: {
          externalSourceId: `ext-${i}`,
          customer: { email: `test${i}@example.com` },
          items: [],
        },
        meta: {},
      })),
      partialSummary: { totalRows: 10, validRows: 10, invalidRows: 0 },
    };
  })();
}

vi.mock('./import-job-service', () => ({
  buildImportPreviewChunksForJob: vi
    .fn()
    .mockImplementation(() => createValidatingChunkGenerator()),
  buildImportPreviewForJob: vi.fn(),
  buildImportJobRowInserts: vi.fn().mockReturnValue(
    Array.from({ length: 10 }, (_, i) => ({
      import_job_id: 'job-1',
      merchant_id: 'merchant-1',
      row_number: i + 1,
      source_external_id: `ext-${i}`,
      row_status: 'create',
      source_payload: {},
      normalized_payload: {},
      validation_errors: [],
      meta: {},
    }))
  ),
  mergeImportJobSummary: vi.fn().mockImplementation((a, b) => ({ ...a, ...b })),
}));

import type { SupabaseClient } from '@supabase/supabase-js';
import { createFailingChunkGenerator } from '@/lib/import-jobs/import-job-test-helpers';
import { logger } from '@/lib/logger';
import type { ImportJobRecord } from './import-job-service';
import { MIGRATION_IMPORT_BUCKET } from './import-job-storage';
import { runClaimedImportJob } from './run-claimed-import-job';

function makeJob(overrides: Partial<ImportJobRecord> = {}): ImportJobRecord {
  return {
    id: 'job-1',
    merchant_id: 'merchant-1',
    created_by: 'user-1',
    source_platform: 'bumpa',
    entity_type: 'orders',
    status: 'validating',
    original_filename: 'orders.csv',
    storage_path: 'merchant-1/orders/file.csv',
    content_type: 'text/csv',
    file_size_bytes: 1024,
    total_rows: 0,
    processed_rows: 0,
    summary: null,
    error: null,
    ...overrides,
  } as ImportJobRecord;
}

function createMockSupabase() {
  const mockDeleteEq = vi.fn().mockResolvedValue({ error: null });
  const mockUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  });

  const mockUpsert = vi.fn().mockResolvedValue({ error: null });
  const mockDelete = vi.fn().mockReturnValue({
    eq: mockDeleteEq,
  });
  const mockStorageRemove = vi
    .fn()
    .mockResolvedValue({ data: [], error: null });
  const mockStorageFrom = vi.fn().mockReturnValue({
    remove: mockStorageRemove,
  });

  const mockQuery = {
    eq: vi.fn(),
    in: vi.fn(),
    not: vi.fn(),
    order: vi.fn().mockResolvedValue({
      data: Array.from({ length: 5 }, (_, i) => ({
        normalized_payload: {
          externalSourceId: `ext-${i}`,
          customer: { email: `test${i}@example.com` },
          items: [],
        },
      })),
      error: null,
    }),
    single: vi.fn().mockResolvedValue({
      data: {
        id: 'merchant-1',
        slug: 'test-merchant',
        business_name: 'Test Store',
        support_email: null,
        email_sender_name: null,
        email: 'merchant@test.com',
      },
      error: null,
    }),
    maybeSingle: vi.fn().mockResolvedValue({
      data: null,
      error: null,
    }),
  };
  mockQuery.eq.mockReturnValue(mockQuery);
  mockQuery.in.mockReturnValue(mockQuery);
  mockQuery.not.mockReturnValue(mockQuery);
  const mockSelect = vi.fn().mockReturnValue(mockQuery);

  return {
    from: vi.fn().mockReturnValue({
      update: mockUpdate,
      upsert: mockUpsert,
      delete: mockDelete,
      select: mockSelect,
    }),
    storage: {
      from: mockStorageFrom,
    },
    __mocks: {
      mockDelete,
      mockDeleteEq,
      mockStorageFrom,
      mockStorageRemove,
    },
  } as unknown as SupabaseClient & {
    __mocks: {
      mockDelete: typeof mockDelete;
      mockDeleteEq: typeof mockDeleteEq;
      mockStorageFrom: typeof mockStorageFrom;
      mockStorageRemove: typeof mockStorageRemove;
    };
  };
}

describe('runClaimedImportJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processes a validating job and returns preview_ready status', async () => {
    const supabase = createMockSupabase();
    const result = await runClaimedImportJob(supabase, makeJob());
    expect(result.status).toBe('preview_ready');
    expect(result.processed).toBe(10);
  });

  it('deletes the source CSV after a preview is ready', async () => {
    const supabase = createMockSupabase();
    const job = makeJob();

    await runClaimedImportJob(supabase, job);

    expect(supabase.__mocks.mockStorageFrom).toHaveBeenCalledWith(
      MIGRATION_IMPORT_BUCKET
    );
    expect(supabase.__mocks.mockStorageRemove).toHaveBeenCalledWith([
      job.storage_path,
    ]);
  });

  it('does not fail the job when source CSV cleanup fails', async () => {
    const supabase = createMockSupabase();
    supabase.__mocks.mockStorageRemove.mockResolvedValueOnce({
      data: null,
      error: { message: 'Storage unavailable' },
    });

    const result = await runClaimedImportJob(supabase, makeJob());

    expect(result.status).toBe('preview_ready');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to clean import source file',
        jobId: 'job-1',
        storagePath: 'merchant-1/orders/file.csv',
      })
    );
  });

  it('processes a committing job for orders', async () => {
    const supabase = createMockSupabase();
    const job = makeJob({ status: 'committing', entity_type: 'orders' });
    const result = await runClaimedImportJob(supabase, job);
    expect(result.status).toBe('committed');
  });

  it('deletes import preview rows after a successful commit', async () => {
    const supabase = createMockSupabase();
    const job = makeJob({ status: 'committing', entity_type: 'orders' });

    await runClaimedImportJob(supabase, job);

    expect(supabase.from).toHaveBeenCalledWith('import_job_rows');
    expect(supabase.__mocks.mockDelete).toHaveBeenCalled();
    expect(supabase.__mocks.mockDeleteEq).toHaveBeenCalledWith(
      'import_job_id',
      job.id
    );
  });

  it('processes a committing job for products', async () => {
    const supabase = createMockSupabase();
    const job = makeJob({ status: 'committing', entity_type: 'products' });
    const result = await runClaimedImportJob(supabase, job);
    expect(result.status).toBe('committed');
  });

  it('processes a notifying job for orders', async () => {
    const supabase = createMockSupabase();
    const job = makeJob({ status: 'notifying', entity_type: 'orders' });
    const result = await runClaimedImportJob(supabase, job);
    expect(result.status).toBe('completed');
  });

  it('returns failed when notifying a non-orders job', async () => {
    const supabase = createMockSupabase();
    const job = makeJob({ status: 'notifying', entity_type: 'products' });
    const result = await runClaimedImportJob(supabase, job);
    expect(result.status).toBe('failed');
  });

  it('returns current status with 0 processed for unknown status', async () => {
    const supabase = createMockSupabase();
    const job = makeJob({
      status: 'preview_ready' as ImportJobRecord['status'],
    });
    const result = await runClaimedImportJob(supabase, job);
    expect(result.status).toBe('preview_ready');
    expect(result.processed).toBe(0);
  });

  it('catches errors and marks job as failed', async () => {
    const supabase = createMockSupabase();
    const { buildImportPreviewChunksForJob } = await import(
      './import-job-service'
    );
    vi.mocked(buildImportPreviewChunksForJob).mockImplementationOnce(() =>
      createFailingChunkGenerator('CSV parse error')
    );

    const result = await runClaimedImportJob(supabase, makeJob());
    expect(result.status).toBe('failed');
    expect('error' in result && result.error).toBe('CSV parse error');
    expect(supabase.__mocks.mockStorageRemove).toHaveBeenCalledWith([
      'merchant-1/orders/file.csv',
    ]);
  });
});
