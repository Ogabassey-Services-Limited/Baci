import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/import-jobs/process-import-job', () => ({
  processImportJobQueue: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({ service: true })),
}));

import { processImportJobQueue } from '@/lib/import-jobs/process-import-job';
import { createServiceClient } from '@/lib/supabase/service';
import { POST } from './route';

describe('POST /api/import-jobs/worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('IMPORT_JOB_WORKER_SECRET', 'worker-secret');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 401 when the worker secret is missing or invalid', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/import-jobs/worker', {
        method: 'POST',
      })
    );

    expect(response.status).toBe(401);
  });

  it('returns 401 when the worker secret is invalid', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/import-jobs/worker', {
        method: 'POST',
        headers: {
          authorization: 'Bearer wrong-secret',
        },
      })
    );

    expect(response.status).toBe(401);
  });

  it('processes queued jobs for authorized worker requests', async () => {
    vi.mocked(processImportJobQueue).mockResolvedValue([
      { id: 'job-1', status: 'preview_ready', processed: 3 },
    ]);

    const response = await POST(
      new NextRequest('http://localhost/api/import-jobs/worker', {
        method: 'POST',
        headers: {
          authorization: 'Bearer worker-secret',
        },
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      processed: 1,
      results: [{ id: 'job-1', status: 'preview_ready', processed: 3 }],
    });
    expect(createServiceClient).toHaveBeenCalledTimes(1);
    expect(processImportJobQueue).toHaveBeenCalledWith({ service: true }, 3);
  });
});
