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
import type { ImportJobRecord, PreviewBuildChunk } from './import-job-service';
import { runClaimedImportJob } from './run-claimed-import-job';

function createFailingChunkGenerator(
  message: string
): AsyncGenerator<PreviewBuildChunk> {
  return (async function* () {
    // Keep the rejected first next() behavior while satisfying Biome's
    // useYield/useAwait rules for async generators in tests.
    yield* [];
    await Promise.resolve();
    throw new Error(message);
  })();
}

function makeJob(overrides: Partial<ImportJobRecord> = {}): ImportJobRecord {
  return {
    id: 'job-1',
    merchant_id: 'merchant-1',
    created_by: 'user-1',
    source_platform: 'bumpa',
    entity_type: 'orders',
    status: 'validating',
    original_filename: 'orders.csv',
    storage_path: 'migration-imports/merchant-1/orders/file.csv',
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
  const mockUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  });

  const mockUpsert = vi.fn().mockResolvedValue({ error: null });
  const mockDelete = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  });

  const mockSelect = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      in: vi.fn().mockReturnValue({
        not: vi.fn().mockReturnValue({
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
        }),
      }),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'merchant-1',
          slug: 'test-merchant',
          business_name: 'Test Store',
          custom_domain: null,
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
    }),
  });

  return {
    from: vi.fn().mockReturnValue({
      update: mockUpdate,
      upsert: mockUpsert,
      delete: mockDelete,
      select: mockSelect,
    }),
  } as unknown as SupabaseClient;
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

  it('processes a committing job for orders', async () => {
    const supabase = createMockSupabase();
    const job = makeJob({ status: 'committing', entity_type: 'orders' });
    const result = await runClaimedImportJob(supabase, job);
    expect(result.status).toBe('committed');
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
  });
});
