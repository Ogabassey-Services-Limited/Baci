import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}));

vi.mock('@/lib/import-jobs/import-job-service', () => ({
  triggerImportWorker: vi.fn(),
}));

vi.mock('@/lib/import-jobs/process-import-job', () => ({
  processImportJobById: vi.fn(),
}));

import { triggerImportWorker } from '@/lib/import-jobs/import-job-service';
import { kickoffImportJob } from '@/lib/import-jobs/kickoff-import-job';
import { processImportJobById } from '@/lib/import-jobs/process-import-job';
import { logger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';

describe('kickoffImportJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createServiceClient).mockReturnValue('service-client' as never);
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

    expect(triggerImportWorker).toHaveBeenCalledWith(
      'https://usebaci.com',
      'job-1'
    );
  });

  it('logs and falls back when direct processing throws', async () => {
    vi.mocked(processImportJobById).mockRejectedValue(new Error('boom'));

    await kickoffImportJob('job-1', 'https://usebaci.com');

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to start import job directly',
        jobId: 'job-1',
        origin: 'https://usebaci.com',
      })
    );
    expect(triggerImportWorker).toHaveBeenCalledWith(
      'https://usebaci.com',
      'job-1'
    );
  });

  it('logs when the worker fallback also fails', async () => {
    vi.mocked(processImportJobById).mockResolvedValue(null);
    vi.mocked(triggerImportWorker).mockRejectedValue(new Error('boom-worker'));

    await kickoffImportJob('job-1', 'https://usebaci.com');

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
});
