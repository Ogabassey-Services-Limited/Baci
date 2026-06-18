import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => ({
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

vi.mock('@/lib/import-jobs/process-import-job', () => ({
  processImportJobById: vi.fn(),
}));

vi.mock('@/lib/import-jobs/trigger-import-job-worker', () => ({
  triggerImportJobWorker: vi.fn(),
}));

import { isProduction } from '@/env';
import {
  kickoffImportJob,
  startImportJob,
} from '@/lib/import-jobs/kickoff-import-job';
import { processImportJobById } from '@/lib/import-jobs/process-import-job';
import { triggerImportJobWorker } from '@/lib/import-jobs/trigger-import-job-worker';
import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createAdminClient).mockReturnValue(
    'service-client' as unknown as ReturnType<typeof createAdminClient>
  );
  vi.mocked(isProduction).mockReturnValue(false);
  vi.mocked(triggerImportJobWorker).mockResolvedValue({
    status: 202,
    triggered: true,
  });
});

describe('startImportJob', () => {
  it('triggers the VPS worker in production', async () => {
    vi.mocked(isProduction).mockReturnValue(true);

    await startImportJob('job-1', 'https://usebaci.com');

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Import job VPS trigger accepted',
        jobId: 'job-1',
        origin: 'https://usebaci.com',
        status: 202,
      })
    );
    expect(triggerImportJobWorker).toHaveBeenCalledWith({
      jobId: 'job-1',
      source: 'api',
    });
    expect(processImportJobById).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('falls back to the VPS cron sweep when the production trigger is not configured', async () => {
    vi.mocked(isProduction).mockReturnValue(true);
    vi.mocked(triggerImportJobWorker).mockResolvedValue({
      reason: 'not_configured',
      triggered: false,
    });

    await startImportJob('job-1', 'https://usebaci.com');

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'Import job persisted; VPS trigger is not configured, cron fallback will process',
        jobId: 'job-1',
        origin: 'https://usebaci.com',
        reason: 'not_configured',
      })
    );
    expect(processImportJobById).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('logs trigger failures and leaves production processing to the VPS cron fallback', async () => {
    const error = new Error('trigger unavailable');
    vi.mocked(isProduction).mockReturnValue(true);
    vi.mocked(triggerImportJobWorker).mockRejectedValue(error);

    await startImportJob('job-1', 'https://usebaci.com');

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Import job VPS trigger failed; cron fallback will process',
        error,
        jobId: 'job-1',
        origin: 'https://usebaci.com',
      })
    );
    expect(processImportJobById).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('processes the targeted job inline in non-production', async () => {
    vi.mocked(processImportJobById).mockResolvedValue({
      id: 'job-1',
      processed: 1,
      status: 'preview_ready',
    });

    await startImportJob('job-1', 'https://usebaci.com');

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Processing import job inline in non-production',
        jobId: 'job-1',
        origin: 'https://usebaci.com',
      })
    );
    expect(processImportJobById).toHaveBeenCalledWith(
      'service-client',
      'job-1'
    );
    expect(createAdminClient).toHaveBeenCalledTimes(1);
  });

  it('propagates non-production inline processing errors', async () => {
    vi.mocked(processImportJobById).mockRejectedValue(new Error('boom'));

    await expect(
      startImportJob('job-1', 'https://usebaci.com')
    ).rejects.toThrow('boom');

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Processing import job inline in non-production',
        jobId: 'job-1',
        origin: 'https://usebaci.com',
      })
    );
    expect(processImportJobById).toHaveBeenCalledWith(
      'service-client',
      'job-1'
    );
  });

  it('logs when non-production inline processing does not claim the job', async () => {
    vi.mocked(processImportJobById).mockResolvedValue(null);

    await startImportJob('job-1', 'https://usebaci.com');

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'Non-production inline import processing did not claim the job',
        jobId: 'job-1',
        origin: 'https://usebaci.com',
      })
    );
  });
});

describe('kickoffImportJob', () => {
  it('is preserved as a backward-compatible alias for startImportJob', async () => {
    vi.mocked(processImportJobById).mockResolvedValue({
      id: 'job-1',
      processed: 1,
      status: 'preview_ready',
    });

    await kickoffImportJob('job-1', 'https://usebaci.com');

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Processing import job inline in non-production',
        jobId: 'job-1',
        origin: 'https://usebaci.com',
      })
    );
    expect(processImportJobById).toHaveBeenCalledWith(
      'service-client',
      'job-1'
    );
    expect(createAdminClient).toHaveBeenCalledTimes(1);
  });
});
