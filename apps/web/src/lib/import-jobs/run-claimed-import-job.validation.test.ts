import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  buildImportPreviewForJobMock,
  buildImportJobRowInsertsMock,
  loggerError,
} = vi.hoisted(() => ({
  buildImportPreviewForJobMock: vi.fn(),
  buildImportJobRowInsertsMock: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@/lib/import-commit/commit-bumpa-orders', () => ({
  commitBumpaOrders: vi.fn(),
}));

vi.mock('@/lib/import-commit/commit-bumpa-products', () => ({
  commitBumpaProducts: vi.fn(),
}));

vi.mock('@/lib/import-notifications/send-import-notification-campaign', () => ({
  sendImportNotificationCampaign: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: loggerError },
}));

vi.mock('./import-job-service', () => ({
  buildImportPreviewForJob: buildImportPreviewForJobMock,
  buildImportJobRowInserts: buildImportJobRowInsertsMock,
  mergeImportJobSummary: vi.fn((_current, summary) => summary),
}));

import { runClaimedImportJob } from './run-claimed-import-job';

type PreviewBuildResult = {
  sourceRows: Array<{ id: string }>;
  rows: Array<{
    rowNumber: number;
    sourceExternalId: string;
    rowStatus: string;
    errors: unknown[];
    payload: unknown;
    meta: Record<string, unknown>;
  }>;
  summary: { validRows: number };
  totalRows: number;
};

function createJob() {
  return {
    id: 'validating-job',
    merchant_id: 'merchant-1',
    created_by: 'user-1',
    source_platform: 'bumpa' as const,
    entity_type: 'orders' as const,
    status: 'validating' as const,
    original_filename: 'validating.csv',
    storage_path: 'validating.csv',
    content_type: 'text/csv',
    file_size_bytes: 100,
    total_rows: 1,
    processed_rows: 0,
    summary: { validRows: 1 },
    error: null,
    created_at: '2026-03-22T10:00:00.000Z',
  };
}

function createPreviewResult(sourceIds: string[]): PreviewBuildResult {
  return {
    sourceRows: sourceIds.map((id) => ({ id })),
    rows: sourceIds.map((id, index) => ({
      rowNumber: index + 2,
      sourceExternalId: id,
      rowStatus: 'create',
      errors: [],
      payload: null,
      meta: {},
    })),
    summary: { validRows: sourceIds.length },
    totalRows: sourceIds.length,
  };
}

function createRowInserts(sourceIds: string[]) {
  return sourceIds.map((id, index) => ({
    import_job_id: 'validating-job',
    merchant_id: 'merchant-1',
    row_number: index + 2,
    source_external_id: id,
    row_status: 'create',
    source_payload: { id },
    normalized_payload: null,
    validation_errors: [],
    meta: {},
  }));
}

function createValidatingSupabase(progressErrors: Array<unknown | null> = []) {
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

  const resolvedProgressErrors = [...progressErrors, null];
  let updateCallCount = 0;
  updateQuery.eq.mockImplementation(() => {
    const error = resolvedProgressErrors[updateCallCount++] ?? null;
    return Promise.resolve({ error });
  });

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

  return {
    deleteQuery,
    insertQuery,
    supabase,
    updateQuery,
  };
}

describe('runClaimedImportJob validating jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('persists preview rows and marks validating jobs as preview_ready', async () => {
    buildImportPreviewForJobMock.mockResolvedValue(
      createPreviewResult(['order-1'])
    );
    buildImportJobRowInsertsMock.mockReturnValue(createRowInserts(['order-1']));

    const { insertQuery, supabase } = createValidatingSupabase();
    const result = await runClaimedImportJob(supabase, createJob());

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
    buildImportPreviewForJobMock.mockImplementation(
      async (_supabase, _job, onProgress) => {
        await onProgress?.({ processedRows: 0, totalRows: 2 });
        await onProgress?.({ processedRows: 1, totalRows: 2 });
        return createPreviewResult(['order-1', 'order-2']);
      }
    );
    buildImportJobRowInsertsMock.mockReturnValue(
      createRowInserts(['order-1', 'order-2'])
    );

    const { supabase, updateQuery } = createValidatingSupabase();
    await runClaimedImportJob(supabase, createJob());

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

  it('logs and continues when a progress update fails', async () => {
    buildImportPreviewForJobMock.mockImplementation(
      async (_supabase, _job, onProgress) => {
        await onProgress?.({ processedRows: 1, totalRows: 2 });
        return createPreviewResult(['order-1', 'order-2']);
      }
    );
    buildImportJobRowInsertsMock.mockReturnValue(
      createRowInserts(['order-1', 'order-2'])
    );

    const { supabase, updateQuery } = createValidatingSupabase([
      { message: 'boom-progress' },
    ]);
    const result = await runClaimedImportJob(supabase, createJob());

    expect(result).toEqual({
      id: 'validating-job',
      status: 'preview_ready',
      processed: 2,
    });
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to update import preview progress',
        jobId: 'validating-job',
        processedRows: 1,
        totalRows: 2,
      })
    );
    expect(updateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'preview_ready',
        processed_rows: 2,
        total_rows: 2,
      })
    );
  });
});
