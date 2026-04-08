import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => ({
  getImportJobWorkerSecret: vi.fn(),
  isProduction: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/import-jobs/import-job-service', () => ({
  triggerImportWorker: vi.fn(),
}));

vi.mock('@/lib/import-jobs/process-import-job', () => ({
  processImportJobById: vi.fn(),
}));

import { getImportJobWorkerSecret, isProduction } from '@/env';
import { triggerImportWorker } from '@/lib/import-jobs/import-job-service';
import {
  kickoffImportJob,
  startImportJob,
} from '@/lib/import-jobs/kickoff-import-job';
import { processImportJobById } from '@/lib/import-jobs/process-import-job';
import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';

describe('kickoffImportJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createAdminClient).mockReturnValue(
      'service-client' as unknown as ReturnType<typeof createAdminClient>
    );
    vi.mocked(getImportJobWorkerSecret).mockReturnValue('worker-secret');
    vi.mocked(isProduction).mockReturnValue(false);
    vi.mocked(triggerImportWorker).mockResolvedValue(undefined);
  });

  it('processes the targeted job directly when it can be claimed', async () => {
    vi.mocked(processImportJobById).mockResolvedValue({
      id: 'job-1',
      processed: 1,
      status: 'preview_ready',
    });

    await kickoffImportJob('job-1', 'https://usebaci.com');

    expect(processImportJobById).toHaveBeenCalledWith(
      'service-client',
      'job-1'
    );
    expect(triggerImportWorker).not.toHaveBeenCalled();
  });

  it('falls back to the worker endpoint when direct processing does not claim the job', async () => {
    vi.mocked(processImportJobById).mockResolvedValue(null);

    await kickoffImportJob('job-1', 'https://usebaci.com');

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'processImportJobById returned falsy, falling back to worker',
        jobId: 'job-1',
        origin: 'https://usebaci.com',
      })
    );
    expect(triggerImportWorker).toHaveBeenCalledWith(
      'https://usebaci.com',
      'job-1'
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Import worker fallback triggered successfully',
        jobId: 'job-1',
        origin: 'https://usebaci.com',
      })
    );
  });

  it('logs and falls back when direct processing throws', async () => {
    vi.mocked(processImportJobById).mockRejectedValue(new Error('boom'));

    await kickoffImportJob('job-1', 'https://usebaci.com');

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to start import job directly',
        error: expect.any(Error),
        jobId: 'job-1',
        origin: 'https://usebaci.com',
      })
    );
    const logPayload = vi.mocked(logger.error).mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(logPayload.error).toBeInstanceOf(Error);
    expect((logPayload.error as Error).message).toBe('boom');
    expect(triggerImportWorker).toHaveBeenCalledWith(
      'https://usebaci.com',
      'job-1'
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Import worker fallback triggered successfully',
        jobId: 'job-1',
        origin: 'https://usebaci.com',
      })
    );
  });

  it('throws when the worker fallback also fails', async () => {
    vi.mocked(processImportJobById).mockResolvedValue(null);
    vi.mocked(triggerImportWorker).mockRejectedValue(new Error('boom-worker'));

    await expect(
      kickoffImportJob('job-1', 'https://usebaci.com')
    ).rejects.toThrow(
      /Import job job-1 failed:.*worker fallback error: boom-worker/
    );

    expect(triggerImportWorker).toHaveBeenCalledWith(
      'https://usebaci.com',
      'job-1'
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to trigger import worker fallback',
        jobId: 'job-1',
        origin: 'https://usebaci.com',
      })
    );
  });

  it('includes both error messages when direct processing and worker both fail', async () => {
    vi.mocked(processImportJobById).mockRejectedValue(new Error('boom-direct'));
    vi.mocked(triggerImportWorker).mockRejectedValue(new Error('boom-worker'));

    await expect(
      kickoffImportJob('job-1', 'https://usebaci.com')
    ).rejects.toThrow(
      /direct processing error: boom-direct.*worker fallback error: boom-worker/
    );

    // Both failure paths should log errors
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to start import job directly',
        jobId: 'job-1',
      })
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to trigger import worker fallback',
        jobId: 'job-1',
      })
    );
  });
});

describe('startImportJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createAdminClient).mockReturnValue(
      'service-client' as unknown as ReturnType<typeof createAdminClient>
    );
    vi.mocked(isProduction).mockReturnValue(false);
    vi.mocked(triggerImportWorker).mockResolvedValue(undefined);
  });

  it('delegates to the worker when the worker secret is configured', async () => {
    vi.mocked(getImportJobWorkerSecret).mockReturnValue('worker-secret');

    await startImportJob('job-1', 'https://usebaci.com');

    expect(triggerImportWorker).toHaveBeenCalledWith(
      'https://usebaci.com',
      'job-1'
    );
    expect(processImportJobById).not.toHaveBeenCalled();
  });

  it('throws in production when the worker secret is missing', async () => {
    vi.mocked(getImportJobWorkerSecret).mockReturnValue(undefined);
    vi.mocked(isProduction).mockReturnValue(true);

    await expect(
      startImportJob('job-1', 'https://usebaci.com')
    ).rejects.toThrow('IMPORT_JOB_WORKER_SECRET is not configured');

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'Import worker secret is required in production when worker delegation is enabled',
        jobId: 'job-1',
        origin: 'https://usebaci.com',
        error: expect.any(Error),
      })
    );
    expect(triggerImportWorker).not.toHaveBeenCalled();
    expect(processImportJobById).not.toHaveBeenCalled();
  });

  it('falls back to inline processing in non-production when the worker secret is missing', async () => {
    vi.mocked(getImportJobWorkerSecret).mockReturnValue(undefined);
    vi.mocked(processImportJobById).mockResolvedValue({
      id: 'job-1',
      processed: 1,
      status: 'preview_ready',
    });

    await startImportJob('job-1', 'https://usebaci.com');

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'IMPORT_JOB_WORKER_SECRET is not set in non-production; processing import job inline',
        jobId: 'job-1',
        origin: 'https://usebaci.com',
      })
    );
    expect(processImportJobById).toHaveBeenCalledWith(
      'service-client',
      'job-1'
    );
    expect(triggerImportWorker).not.toHaveBeenCalled();
  });
});
