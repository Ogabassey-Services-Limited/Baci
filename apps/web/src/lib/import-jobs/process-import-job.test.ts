import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/import-jobs/run-claimed-import-job', () => ({
  runClaimedImportJob: vi.fn(),
}));

import {
  processImportJobById,
  processImportJobQueue,
} from '@/lib/import-jobs/process-import-job';
import { runClaimedImportJob } from '@/lib/import-jobs/run-claimed-import-job';

function createJob(status: 'uploaded' | 'commit_queued' | 'notify_queued') {
  return {
    id: `${status}-job`,
    merchant_id: 'merchant-1',
    created_by: 'user-1',
    source_platform: 'bumpa',
    entity_type: 'orders',
    status,
    original_filename: `${status}.csv`,
    storage_path: `${status}.csv`,
    content_type: 'text/csv',
    file_size_bytes: 100,
    total_rows: 1,
    processed_rows: 0,
    summary: null,
    error: null,
    created_at: '2026-03-22T10:00:00.000Z',
  };
}

describe('processImportJobQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('claims queued jobs and runs them in claimed status order', async () => {
    const loadQuery = {
      select: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    loadQuery.select.mockReturnValue(loadQuery);
    loadQuery.in.mockReturnValue(loadQuery);
    loadQuery.order.mockReturnValue(loadQuery);
    loadQuery.limit.mockResolvedValue({
      data: [createJob('uploaded'), createJob('commit_queued')],
      error: null,
    });

    const claimValidatingQuery = {
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
    };
    claimValidatingQuery.update.mockReturnValue(claimValidatingQuery);
    claimValidatingQuery.eq
      .mockReturnValueOnce(claimValidatingQuery)
      .mockReturnValueOnce(claimValidatingQuery);
    claimValidatingQuery.select.mockReturnValue(claimValidatingQuery);
    claimValidatingQuery.single.mockResolvedValue({
      data: { ...createJob('uploaded'), status: 'validating' },
      error: null,
    });

    const claimCommittingQuery = {
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
    };
    claimCommittingQuery.update.mockReturnValue(claimCommittingQuery);
    claimCommittingQuery.eq
      .mockReturnValueOnce(claimCommittingQuery)
      .mockReturnValueOnce(claimCommittingQuery);
    claimCommittingQuery.select.mockReturnValue(claimCommittingQuery);
    claimCommittingQuery.single.mockResolvedValue({
      data: { ...createJob('commit_queued'), status: 'committing' },
      error: null,
    });

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(loadQuery)
        .mockReturnValueOnce(claimValidatingQuery)
        .mockReturnValueOnce(claimCommittingQuery),
    } as unknown as SupabaseClient;

    vi.mocked(runClaimedImportJob)
      .mockResolvedValueOnce({
        id: 'uploaded-job',
        status: 'preview_ready',
        processed: 1,
      })
      .mockResolvedValueOnce({
        id: 'commit_queued-job',
        status: 'committed',
        processed: 1,
      });

    const result = await processImportJobQueue(supabase, 2);

    expect(result).toEqual([
      { id: 'uploaded-job', status: 'preview_ready', processed: 1 },
      { id: 'commit_queued-job', status: 'committed', processed: 1 },
    ]);
    expect(runClaimedImportJob).toHaveBeenNthCalledWith(
      1,
      supabase,
      expect.objectContaining({ id: 'uploaded-job', status: 'validating' })
    );
    expect(runClaimedImportJob).toHaveBeenNthCalledWith(
      2,
      supabase,
      expect.objectContaining({ id: 'commit_queued-job', status: 'committing' })
    );
  });

  it('skips jobs that cannot be claimed', async () => {
    const loadQuery = {
      select: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    loadQuery.select.mockReturnValue(loadQuery);
    loadQuery.in.mockReturnValue(loadQuery);
    loadQuery.order.mockReturnValue(loadQuery);
    loadQuery.limit.mockResolvedValue({
      data: [createJob('notify_queued')],
      error: null,
    });

    const failedClaimQuery = {
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
    };
    failedClaimQuery.update.mockReturnValue(failedClaimQuery);
    failedClaimQuery.eq
      .mockReturnValueOnce(failedClaimQuery)
      .mockReturnValueOnce(failedClaimQuery);
    failedClaimQuery.select.mockReturnValue(failedClaimQuery);
    failedClaimQuery.single.mockResolvedValue({
      data: null,
      error: { message: 'conflict' },
    });

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(loadQuery)
        .mockReturnValueOnce(failedClaimQuery),
    } as unknown as SupabaseClient;

    const result = await processImportJobQueue(supabase, 1);

    expect(result).toEqual([]);
    expect(runClaimedImportJob).not.toHaveBeenCalled();
  });
});

describe('processImportJobById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('claims and runs a specific queued job', async () => {
    const loadQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    loadQuery.select.mockReturnValue(loadQuery);
    loadQuery.eq.mockReturnValue(loadQuery);
    loadQuery.maybeSingle.mockResolvedValue({
      data: createJob('uploaded'),
      error: null,
    });

    const claimQuery = {
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
    };
    claimQuery.update.mockReturnValue(claimQuery);
    claimQuery.eq
      .mockReturnValueOnce(claimQuery)
      .mockReturnValueOnce(claimQuery);
    claimQuery.select.mockReturnValue(claimQuery);
    claimQuery.single.mockResolvedValue({
      data: { ...createJob('uploaded'), status: 'validating' },
      error: null,
    });

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(loadQuery)
        .mockReturnValueOnce(claimQuery),
    } as unknown as SupabaseClient;

    vi.mocked(runClaimedImportJob).mockResolvedValueOnce({
      id: 'uploaded-job',
      status: 'preview_ready',
      processed: 1,
    });

    const result = await processImportJobById(supabase, 'uploaded-job');

    expect(result).toEqual({
      id: 'uploaded-job',
      status: 'preview_ready',
      processed: 1,
    });
    expect(supabase.from).toHaveBeenCalledWith('import_jobs');
    expect(loadQuery.eq).toHaveBeenCalledWith('id', 'uploaded-job');
    expect(claimQuery.eq).toHaveBeenCalledWith('id', 'uploaded-job');
    expect(runClaimedImportJob).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ id: 'uploaded-job', status: 'validating' })
    );
  });

  it('returns null when the specific job is not queued', async () => {
    const loadQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    loadQuery.select.mockReturnValue(loadQuery);
    loadQuery.eq.mockReturnValue(loadQuery);
    loadQuery.maybeSingle.mockResolvedValue({
      data: { ...createJob('uploaded'), status: 'preview_ready' },
      error: null,
    });

    const supabase = {
      from: vi.fn().mockReturnValue(loadQuery),
    } as unknown as SupabaseClient;

    const result = await processImportJobById(supabase, 'uploaded-job');

    expect(result).toBeNull();
    expect(runClaimedImportJob).not.toHaveBeenCalled();
  });

  it('returns null when the specific job does not exist', async () => {
    const loadQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    loadQuery.select.mockReturnValue(loadQuery);
    loadQuery.eq.mockReturnValue(loadQuery);
    loadQuery.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    const supabase = {
      from: vi.fn().mockReturnValue(loadQuery),
    } as unknown as SupabaseClient;

    const result = await processImportJobById(supabase, 'uploaded-job');

    expect(result).toBeNull();
    expect(runClaimedImportJob).not.toHaveBeenCalled();
  });
});
