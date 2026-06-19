import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  getImportJobWorkerBatchSize: vi.fn(),
  processImportJobById: vi.fn(),
  processImportJobQueue: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock('@/lib/import-jobs/process-import-job', () => ({
  processImportJobById: mocks.processImportJobById,
  processImportJobQueue: mocks.processImportJobQueue,
}));

vi.mock('@/env', () => ({
  getImportJobWorkerBatchSize: mocks.getImportJobWorkerBatchSize,
}));

import { runProcessImportJobsCli } from './process-import-jobs';

describe('runProcessImportJobsCli', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getImportJobWorkerBatchSize.mockReturnValue(3);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs the import queue with the default batch size', async () => {
    const supabase = { service: true };
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mocks.createServiceClient.mockReturnValue(supabase);
    mocks.processImportJobQueue.mockResolvedValue([
      { id: 'job-1', status: 'preview_ready' },
      { id: 'job-2', status: 'committed' },
    ]);

    const exitCode = await runProcessImportJobsCli();

    expect(exitCode).toBe(0);
    expect(mocks.processImportJobQueue).toHaveBeenCalledWith(supabase, 3);
    expect(JSON.parse(logSpy.mock.calls[0]?.[0] ?? '{}')).toMatchObject({
      processed: 2,
      statusCounts: {
        preview_ready: 1,
        committed: 1,
      },
    });
  });

  it('uses a configured batch size and returns non-zero when a job fails', async () => {
    mocks.getImportJobWorkerBatchSize.mockReturnValue(7);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mocks.createServiceClient.mockReturnValue({ service: true });
    mocks.processImportJobQueue.mockResolvedValue([
      { id: 'job-1', status: 'failed' },
    ]);

    const exitCode = await runProcessImportJobsCli();

    expect(exitCode).toBe(1);
    expect(mocks.processImportJobQueue).toHaveBeenCalledWith(
      { service: true },
      7
    );
    expect(JSON.parse(logSpy.mock.calls[0]?.[0] ?? '{}')).toMatchObject({
      processed: 1,
      statusCounts: { failed: 1 },
    });
  });

  it('processes a single triggered job when IMPORT_JOB_TRIGGER_JOB_ID is set', async () => {
    const supabase = { service: true };
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mocks.createServiceClient.mockReturnValue(supabase);
    mocks.processImportJobById.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      status: 'preview_ready',
      processed: 5903,
    });

    const exitCode = await runProcessImportJobsCli({
      env: {
        IMPORT_JOB_TRIGGER_JOB_ID: '11111111-1111-4111-8111-111111111111',
      },
    });

    expect(exitCode).toBe(0);
    expect(mocks.processImportJobById).toHaveBeenCalledWith(
      supabase,
      '11111111-1111-4111-8111-111111111111'
    );
    expect(mocks.processImportJobQueue).not.toHaveBeenCalled();
    expect(JSON.parse(logSpy.mock.calls[0]?.[0] ?? '{}')).toMatchObject({
      processed: 1,
      statusCounts: { preview_ready: 1 },
    });
  });

  it('returns non-zero when a triggered job is not claimed', async () => {
    const supabase = { service: true };
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.createServiceClient.mockReturnValue(supabase);
    mocks.processImportJobById.mockResolvedValue(null);

    const exitCode = await runProcessImportJobsCli({
      env: {
        IMPORT_JOB_TRIGGER_JOB_ID: '11111111-1111-4111-8111-111111111111',
      },
    });

    expect(exitCode).toBe(1);
    expect(mocks.processImportJobById).toHaveBeenCalledWith(
      supabase,
      '11111111-1111-4111-8111-111111111111'
    );
    expect(JSON.parse(logSpy.mock.calls[0]?.[0] ?? '{}')).toMatchObject({
      processed: 0,
      statusCounts: {},
    });
    expect(JSON.parse(errorSpy.mock.calls[0]?.[0] ?? '{}')).toMatchObject({
      jobId: '11111111-1111-4111-8111-111111111111',
      message: 'Triggered import job was not claimed',
    });
  });

  it('returns non-zero when a triggered job fails', async () => {
    const supabase = { service: true };
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mocks.createServiceClient.mockReturnValue(supabase);
    mocks.processImportJobById.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      status: 'failed',
    });

    const exitCode = await runProcessImportJobsCli({
      env: {
        IMPORT_JOB_TRIGGER_JOB_ID: '11111111-1111-4111-8111-111111111111',
      },
    });

    expect(exitCode).toBe(1);
    expect(JSON.parse(logSpy.mock.calls[0]?.[0] ?? '{}')).toMatchObject({
      processed: 1,
      statusCounts: { failed: 1 },
    });
  });

  it('rejects an invalid triggered job id', async () => {
    await expect(
      runProcessImportJobsCli({
        env: { IMPORT_JOB_TRIGGER_JOB_ID: 'not-a-uuid' },
      })
    ).rejects.toThrow('IMPORT_JOB_TRIGGER_JOB_ID must be a UUID');

    expect(mocks.processImportJobById).not.toHaveBeenCalled();
    expect(mocks.processImportJobQueue).not.toHaveBeenCalled();
  });
});
