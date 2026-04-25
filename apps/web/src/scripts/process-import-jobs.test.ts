import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  processImportJobQueue: vi.fn(),
}));

vi.mock('../lib/supabase/service', () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock('../lib/import-jobs/process-import-job', () => ({
  processImportJobQueue: mocks.processImportJobQueue,
}));

import { runProcessImportJobsCli } from './process-import-jobs';

describe('runProcessImportJobsCli', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.IMPORT_JOB_WORKER_BATCH_SIZE;
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
    process.env.IMPORT_JOB_WORKER_BATCH_SIZE = '7';
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
});
