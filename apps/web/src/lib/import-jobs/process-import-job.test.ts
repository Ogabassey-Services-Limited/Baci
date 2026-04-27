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

  it('reserves an uploaded slot while prioritizing merchant-triggered commit jobs', async () => {
    const loadCommitQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    loadCommitQuery.select.mockReturnValue(loadCommitQuery);
    loadCommitQuery.eq.mockReturnValue(loadCommitQuery);
    loadCommitQuery.order.mockReturnValue(loadCommitQuery);
    loadCommitQuery.limit.mockResolvedValue({
      data: [createJob('commit_queued')],
      error: null,
    });

    const loadNotifyQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    loadNotifyQuery.select.mockReturnValue(loadNotifyQuery);
    loadNotifyQuery.eq.mockReturnValue(loadNotifyQuery);
    loadNotifyQuery.order.mockReturnValue(loadNotifyQuery);
    loadNotifyQuery.limit.mockResolvedValue({
      data: [createJob('notify_queued')],
      error: null,
    });

    const loadUploadedQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    loadUploadedQuery.select.mockReturnValue(loadUploadedQuery);
    loadUploadedQuery.eq.mockReturnValue(loadUploadedQuery);
    loadUploadedQuery.order.mockReturnValue(loadUploadedQuery);
    loadUploadedQuery.limit.mockResolvedValue({
      data: [createJob('uploaded')],
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

    const claimNotifyingQuery = {
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
    };
    claimNotifyingQuery.update.mockReturnValue(claimNotifyingQuery);
    claimNotifyingQuery.eq
      .mockReturnValueOnce(claimNotifyingQuery)
      .mockReturnValueOnce(claimNotifyingQuery);
    claimNotifyingQuery.select.mockReturnValue(claimNotifyingQuery);
    claimNotifyingQuery.single.mockResolvedValue({
      data: { ...createJob('notify_queued'), status: 'notifying' },
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

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(loadCommitQuery)
        .mockReturnValueOnce(loadNotifyQuery)
        .mockReturnValueOnce(loadUploadedQuery)
        .mockReturnValueOnce(claimCommittingQuery)
        .mockReturnValueOnce(claimNotifyingQuery)
        .mockReturnValueOnce(claimValidatingQuery),
    } as unknown as SupabaseClient;

    vi.mocked(runClaimedImportJob)
      .mockResolvedValueOnce({
        id: 'commit_queued-job',
        status: 'committed',
        processed: 1,
      })
      .mockResolvedValueOnce({
        id: 'notify_queued-job',
        status: 'notified',
        processed: 1,
      })
      .mockResolvedValueOnce({
        id: 'uploaded-job',
        status: 'preview_ready',
        processed: 1,
      });

    const result = await processImportJobQueue(supabase, 3);

    expect(result).toEqual([
      { id: 'commit_queued-job', status: 'committed', processed: 1 },
      { id: 'notify_queued-job', status: 'notified', processed: 1 },
      { id: 'uploaded-job', status: 'preview_ready', processed: 1 },
    ]);
    expect(loadCommitQuery.eq).toHaveBeenCalledWith('status', 'commit_queued');
    expect(loadNotifyQuery.eq).toHaveBeenCalledWith('status', 'notify_queued');
    expect(loadUploadedQuery.eq).toHaveBeenCalledWith('status', 'uploaded');
    expect(loadCommitQuery.order).toHaveBeenCalledWith('created_at', {
      ascending: true,
    });
    expect(loadNotifyQuery.order).toHaveBeenCalledWith('created_at', {
      ascending: true,
    });
    expect(loadUploadedQuery.order).toHaveBeenCalledWith('created_at', {
      ascending: true,
    });
    expect(loadCommitQuery.limit).toHaveBeenCalledWith(3);
    expect(loadNotifyQuery.limit).toHaveBeenCalledWith(2);
    expect(loadUploadedQuery.limit).toHaveBeenCalledWith(1);
    expect(runClaimedImportJob).toHaveBeenNthCalledWith(
      1,
      supabase,
      expect.objectContaining({ id: 'commit_queued-job', status: 'committing' })
    );
    expect(runClaimedImportJob).toHaveBeenNthCalledWith(
      2,
      supabase,
      expect.objectContaining({ id: 'notify_queued-job', status: 'notifying' })
    );
    expect(runClaimedImportJob).toHaveBeenNthCalledWith(
      3,
      supabase,
      expect.objectContaining({ id: 'uploaded-job', status: 'validating' })
    );
  });

  it('backfills the uploaded reserve when there are no uploaded jobs', async () => {
    const commitJobs = [
      { ...createJob('commit_queued'), id: 'commit-job-1' },
      { ...createJob('commit_queued'), id: 'commit-job-2' },
      { ...createJob('commit_queued'), id: 'commit-job-3' },
    ];
    const loadCommitQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    loadCommitQuery.select.mockReturnValue(loadCommitQuery);
    loadCommitQuery.eq.mockReturnValue(loadCommitQuery);
    loadCommitQuery.order.mockReturnValue(loadCommitQuery);
    loadCommitQuery.limit.mockResolvedValue({
      data: commitJobs,
      error: null,
    });

    const loadNotifyQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    loadNotifyQuery.select.mockReturnValue(loadNotifyQuery);
    loadNotifyQuery.eq.mockReturnValue(loadNotifyQuery);
    loadNotifyQuery.order.mockReturnValue(loadNotifyQuery);
    loadNotifyQuery.limit.mockResolvedValue({
      data: [],
      error: null,
    });

    const loadUploadedQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    loadUploadedQuery.select.mockReturnValue(loadUploadedQuery);
    loadUploadedQuery.eq.mockReturnValue(loadUploadedQuery);
    loadUploadedQuery.order.mockReturnValue(loadUploadedQuery);
    loadUploadedQuery.limit.mockResolvedValue({
      data: [],
      error: null,
    });

    const claimQueries = commitJobs.map((job) => {
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
        data: { ...job, status: 'committing' },
        error: null,
      });
      return claimQuery;
    });

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(loadCommitQuery)
        .mockReturnValueOnce(loadNotifyQuery)
        .mockReturnValueOnce(loadUploadedQuery)
        .mockReturnValueOnce(claimQueries[0])
        .mockReturnValueOnce(claimQueries[1])
        .mockReturnValueOnce(claimQueries[2]),
    } as unknown as SupabaseClient;

    vi.mocked(runClaimedImportJob)
      .mockResolvedValueOnce({
        id: 'commit-job-1',
        status: 'committed',
        processed: 1,
      })
      .mockResolvedValueOnce({
        id: 'commit-job-2',
        status: 'committed',
        processed: 1,
      })
      .mockResolvedValueOnce({
        id: 'commit-job-3',
        status: 'committed',
        processed: 1,
      });

    const result = await processImportJobQueue(supabase, 3);

    expect(result).toEqual([
      { id: 'commit-job-1', status: 'committed', processed: 1 },
      { id: 'commit-job-2', status: 'committed', processed: 1 },
      { id: 'commit-job-3', status: 'committed', processed: 1 },
    ]);
    expect(loadCommitQuery.limit).toHaveBeenCalledWith(3);
    expect(loadNotifyQuery.limit).toHaveBeenCalledWith(1);
    expect(loadUploadedQuery.limit).toHaveBeenCalledWith(1);
    expect(runClaimedImportJob).toHaveBeenCalledTimes(3);
  });

  it('backfills the batch with uploaded jobs when higher-priority queues are empty', async () => {
    const uploadedJobs = Array.from({ length: 5 }, (_, index) => ({
      ...createJob('uploaded'),
      id: `uploaded-job-${index + 1}`,
    }));
    const loadCommitQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    loadCommitQuery.select.mockReturnValue(loadCommitQuery);
    loadCommitQuery.eq.mockReturnValue(loadCommitQuery);
    loadCommitQuery.order.mockReturnValue(loadCommitQuery);
    loadCommitQuery.limit.mockResolvedValue({
      data: [],
      error: null,
    });

    const loadNotifyQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    loadNotifyQuery.select.mockReturnValue(loadNotifyQuery);
    loadNotifyQuery.eq.mockReturnValue(loadNotifyQuery);
    loadNotifyQuery.order.mockReturnValue(loadNotifyQuery);
    loadNotifyQuery.limit.mockResolvedValue({
      data: [],
      error: null,
    });

    const loadUploadedQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    loadUploadedQuery.select.mockReturnValue(loadUploadedQuery);
    loadUploadedQuery.eq.mockReturnValue(loadUploadedQuery);
    loadUploadedQuery.order.mockReturnValue(loadUploadedQuery);
    loadUploadedQuery.limit.mockResolvedValue({
      data: uploadedJobs,
      error: null,
    });

    const claimQueries = uploadedJobs.map((job) => {
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
        data: { ...job, status: 'validating' },
        error: null,
      });
      return claimQuery;
    });

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(loadCommitQuery)
        .mockReturnValueOnce(loadNotifyQuery)
        .mockReturnValueOnce(loadUploadedQuery)
        .mockReturnValueOnce(claimQueries[0])
        .mockReturnValueOnce(claimQueries[1])
        .mockReturnValueOnce(claimQueries[2])
        .mockReturnValueOnce(claimQueries[3])
        .mockReturnValueOnce(claimQueries[4]),
    } as unknown as SupabaseClient;

    for (const job of uploadedJobs) {
      vi.mocked(runClaimedImportJob).mockResolvedValueOnce({
        id: job.id,
        status: 'preview_ready',
        processed: 1,
      });
    }

    const result = await processImportJobQueue(supabase, 5);

    expect(result).toEqual(
      uploadedJobs.map((job) => ({
        id: job.id,
        status: 'preview_ready',
        processed: 1,
      }))
    );
    expect(loadCommitQuery.limit).toHaveBeenCalledWith(5);
    expect(loadNotifyQuery.limit).toHaveBeenCalledWith(5);
    expect(loadUploadedQuery.limit).toHaveBeenCalledWith(5);
    expect(runClaimedImportJob).toHaveBeenCalledTimes(5);
  });

  it('reserves a notify slot when commit jobs fill the batch', async () => {
    const commitJobs = [
      { ...createJob('commit_queued'), id: 'commit-job-1' },
      { ...createJob('commit_queued'), id: 'commit-job-2' },
      { ...createJob('commit_queued'), id: 'commit-job-3' },
    ];
    const loadCommitQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    loadCommitQuery.select.mockReturnValue(loadCommitQuery);
    loadCommitQuery.eq.mockReturnValue(loadCommitQuery);
    loadCommitQuery.order.mockReturnValue(loadCommitQuery);
    loadCommitQuery.limit.mockResolvedValue({
      data: commitJobs,
      error: null,
    });

    const loadNotifyQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    loadNotifyQuery.select.mockReturnValue(loadNotifyQuery);
    loadNotifyQuery.eq.mockReturnValue(loadNotifyQuery);
    loadNotifyQuery.order.mockReturnValue(loadNotifyQuery);
    loadNotifyQuery.limit.mockResolvedValue({
      data: [{ ...createJob('notify_queued'), id: 'notify-job-1' }],
      error: null,
    });

    const loadUploadedQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    loadUploadedQuery.select.mockReturnValue(loadUploadedQuery);
    loadUploadedQuery.eq.mockReturnValue(loadUploadedQuery);
    loadUploadedQuery.order.mockReturnValue(loadUploadedQuery);
    loadUploadedQuery.limit.mockResolvedValue({
      data: [],
      error: null,
    });

    const claimedJobs = [
      { ...commitJobs[0], status: 'committing' },
      { ...commitJobs[1], status: 'committing' },
      {
        ...createJob('notify_queued'),
        id: 'notify-job-1',
        status: 'notifying',
      },
    ];
    const claimQueries = claimedJobs.map((job) => {
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
        data: job,
        error: null,
      });
      return claimQuery;
    });

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(loadCommitQuery)
        .mockReturnValueOnce(loadNotifyQuery)
        .mockReturnValueOnce(loadUploadedQuery)
        .mockReturnValueOnce(claimQueries[0])
        .mockReturnValueOnce(claimQueries[1])
        .mockReturnValueOnce(claimQueries[2]),
    } as unknown as SupabaseClient;

    vi.mocked(runClaimedImportJob)
      .mockResolvedValueOnce({
        id: 'commit-job-1',
        status: 'committed',
        processed: 1,
      })
      .mockResolvedValueOnce({
        id: 'commit-job-2',
        status: 'committed',
        processed: 1,
      })
      .mockResolvedValueOnce({
        id: 'notify-job-1',
        status: 'notified',
        processed: 1,
      });

    const result = await processImportJobQueue(supabase, 3);

    expect(result).toEqual([
      { id: 'commit-job-1', status: 'committed', processed: 1 },
      { id: 'commit-job-2', status: 'committed', processed: 1 },
      { id: 'notify-job-1', status: 'notified', processed: 1 },
    ]);
    expect(loadCommitQuery.limit).toHaveBeenCalledWith(3);
    expect(loadNotifyQuery.limit).toHaveBeenCalledWith(1);
    expect(loadUploadedQuery.limit).toHaveBeenCalledWith(1);
  });

  it('keeps a commit slot when a small batch has notify and uploaded work', async () => {
    const loadCommitQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    loadCommitQuery.select.mockReturnValue(loadCommitQuery);
    loadCommitQuery.eq.mockReturnValue(loadCommitQuery);
    loadCommitQuery.order.mockReturnValue(loadCommitQuery);
    loadCommitQuery.limit.mockResolvedValue({
      data: [
        { ...createJob('commit_queued'), id: 'commit-job-1' },
        { ...createJob('commit_queued'), id: 'commit-job-2' },
      ],
      error: null,
    });

    const loadNotifyQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    loadNotifyQuery.select.mockReturnValue(loadNotifyQuery);
    loadNotifyQuery.eq.mockReturnValue(loadNotifyQuery);
    loadNotifyQuery.order.mockReturnValue(loadNotifyQuery);
    loadNotifyQuery.limit.mockResolvedValue({
      data: [{ ...createJob('notify_queued'), id: 'notify-job-1' }],
      error: null,
    });

    const loadUploadedQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    loadUploadedQuery.select.mockReturnValue(loadUploadedQuery);
    loadUploadedQuery.eq.mockReturnValue(loadUploadedQuery);
    loadUploadedQuery.order.mockReturnValue(loadUploadedQuery);
    loadUploadedQuery.limit.mockResolvedValue({
      data: [{ ...createJob('uploaded'), id: 'uploaded-job-1' }],
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
      data: {
        ...createJob('commit_queued'),
        id: 'commit-job-1',
        status: 'committing',
      },
      error: null,
    });

    const claimNotifyingQuery = {
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
    };
    claimNotifyingQuery.update.mockReturnValue(claimNotifyingQuery);
    claimNotifyingQuery.eq
      .mockReturnValueOnce(claimNotifyingQuery)
      .mockReturnValueOnce(claimNotifyingQuery);
    claimNotifyingQuery.select.mockReturnValue(claimNotifyingQuery);
    claimNotifyingQuery.single.mockResolvedValue({
      data: {
        ...createJob('notify_queued'),
        id: 'notify-job-1',
        status: 'notifying',
      },
      error: null,
    });

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(loadCommitQuery)
        .mockReturnValueOnce(loadNotifyQuery)
        .mockReturnValueOnce(loadUploadedQuery)
        .mockReturnValueOnce(claimCommittingQuery)
        .mockReturnValueOnce(claimNotifyingQuery),
    } as unknown as SupabaseClient;

    vi.mocked(runClaimedImportJob)
      .mockResolvedValueOnce({
        id: 'commit-job-1',
        status: 'committed',
        processed: 1,
      })
      .mockResolvedValueOnce({
        id: 'notify-job-1',
        status: 'notified',
        processed: 1,
      });

    const result = await processImportJobQueue(supabase, 2);

    expect(result).toEqual([
      { id: 'commit-job-1', status: 'committed', processed: 1 },
      { id: 'notify-job-1', status: 'notified', processed: 1 },
    ]);
    expect(loadCommitQuery.limit).toHaveBeenCalledWith(2);
    expect(loadNotifyQuery.limit).toHaveBeenCalledWith(1);
    expect(loadUploadedQuery.limit).toHaveBeenCalledWith(1);
  });

  it('throws when a per-status queue load fails', async () => {
    const loadCommitQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    loadCommitQuery.select.mockReturnValue(loadCommitQuery);
    loadCommitQuery.eq.mockReturnValue(loadCommitQuery);
    loadCommitQuery.order.mockReturnValue(loadCommitQuery);
    loadCommitQuery.limit.mockResolvedValue({
      data: null,
      error: { message: 'db down' },
    });

    const supabase = {
      from: vi.fn().mockReturnValueOnce(loadCommitQuery),
    } as unknown as SupabaseClient;

    await expect(processImportJobQueue(supabase, 5)).rejects.toThrow(
      'Failed to load queued import jobs for status commit_queued: db down'
    );
    expect(runClaimedImportJob).not.toHaveBeenCalled();
  });

  it('keeps commit priority when the batch size is one', async () => {
    const loadCommitQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    loadCommitQuery.select.mockReturnValue(loadCommitQuery);
    loadCommitQuery.eq.mockReturnValue(loadCommitQuery);
    loadCommitQuery.order.mockReturnValue(loadCommitQuery);
    loadCommitQuery.limit.mockResolvedValue({
      data: [createJob('commit_queued')],
      error: null,
    });

    const loadUploadedQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    loadUploadedQuery.select.mockReturnValue(loadUploadedQuery);
    loadUploadedQuery.eq.mockReturnValue(loadUploadedQuery);
    loadUploadedQuery.order.mockReturnValue(loadUploadedQuery);
    loadUploadedQuery.limit.mockResolvedValue({
      data: [createJob('uploaded')],
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
        .mockReturnValueOnce(loadCommitQuery)
        .mockReturnValueOnce(loadUploadedQuery)
        .mockReturnValueOnce(claimCommittingQuery),
    } as unknown as SupabaseClient;

    vi.mocked(runClaimedImportJob).mockResolvedValueOnce({
      id: 'commit_queued-job',
      status: 'committed',
      processed: 1,
    });

    const result = await processImportJobQueue(supabase, 1);

    expect(result).toEqual([
      { id: 'commit_queued-job', status: 'committed', processed: 1 },
    ]);
    expect(loadCommitQuery.limit).toHaveBeenCalledWith(1);
    expect(loadUploadedQuery.limit).toHaveBeenCalledWith(1);
    expect(runClaimedImportJob).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ id: 'commit_queued-job', status: 'committing' })
    );
  });

  it('processes uploaded jobs with batch size one when no higher-priority jobs exist', async () => {
    const loadCommitQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    loadCommitQuery.select.mockReturnValue(loadCommitQuery);
    loadCommitQuery.eq.mockReturnValue(loadCommitQuery);
    loadCommitQuery.order.mockReturnValue(loadCommitQuery);
    loadCommitQuery.limit.mockResolvedValue({
      data: [],
      error: null,
    });

    const loadNotifyQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    loadNotifyQuery.select.mockReturnValue(loadNotifyQuery);
    loadNotifyQuery.eq.mockReturnValue(loadNotifyQuery);
    loadNotifyQuery.order.mockReturnValue(loadNotifyQuery);
    loadNotifyQuery.limit.mockResolvedValue({
      data: [],
      error: null,
    });

    const loadUploadedQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    loadUploadedQuery.select.mockReturnValue(loadUploadedQuery);
    loadUploadedQuery.eq.mockReturnValue(loadUploadedQuery);
    loadUploadedQuery.order.mockReturnValue(loadUploadedQuery);
    loadUploadedQuery.limit.mockResolvedValue({
      data: [createJob('uploaded')],
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

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(loadCommitQuery)
        .mockReturnValueOnce(loadNotifyQuery)
        .mockReturnValueOnce(loadUploadedQuery)
        .mockReturnValueOnce(claimValidatingQuery),
    } as unknown as SupabaseClient;

    vi.mocked(runClaimedImportJob).mockResolvedValueOnce({
      id: 'uploaded-job',
      status: 'preview_ready',
      processed: 1,
    });

    const result = await processImportJobQueue(supabase, 1);

    expect(result).toEqual([
      { id: 'uploaded-job', status: 'preview_ready', processed: 1 },
    ]);
    expect(loadCommitQuery.limit).toHaveBeenCalledWith(1);
    expect(loadNotifyQuery.limit).toHaveBeenCalledWith(1);
    expect(loadUploadedQuery.limit).toHaveBeenCalledWith(1);
    expect(runClaimedImportJob).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ id: 'uploaded-job', status: 'validating' })
    );
  });

  it('skips jobs that cannot be claimed', async () => {
    const loadCommitQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    loadCommitQuery.select.mockReturnValue(loadCommitQuery);
    loadCommitQuery.eq.mockReturnValue(loadCommitQuery);
    loadCommitQuery.order.mockReturnValue(loadCommitQuery);
    loadCommitQuery.limit.mockResolvedValue({
      data: [],
      error: null,
    });

    const loadNotifyQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    loadNotifyQuery.select.mockReturnValue(loadNotifyQuery);
    loadNotifyQuery.eq.mockReturnValue(loadNotifyQuery);
    loadNotifyQuery.order.mockReturnValue(loadNotifyQuery);
    loadNotifyQuery.limit.mockResolvedValue({
      data: [createJob('notify_queued')],
      error: null,
    });

    const loadUploadedQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    loadUploadedQuery.select.mockReturnValue(loadUploadedQuery);
    loadUploadedQuery.eq.mockReturnValue(loadUploadedQuery);
    loadUploadedQuery.order.mockReturnValue(loadUploadedQuery);
    loadUploadedQuery.limit.mockResolvedValue({
      data: [],
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
        .mockReturnValueOnce(loadCommitQuery)
        .mockReturnValueOnce(loadNotifyQuery)
        .mockReturnValueOnce(loadUploadedQuery)
        .mockReturnValueOnce(failedClaimQuery),
    } as unknown as SupabaseClient;

    const result = await processImportJobQueue(supabase, 1);

    expect(result).toEqual([]);
    expect(loadCommitQuery.limit).toHaveBeenCalledWith(1);
    expect(loadNotifyQuery.limit).toHaveBeenCalledWith(1);
    expect(loadUploadedQuery.limit).toHaveBeenCalledWith(1);
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
