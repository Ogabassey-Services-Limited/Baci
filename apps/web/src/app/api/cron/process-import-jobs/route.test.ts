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
import { GET, POST } from './route';

describe('/api/cron/process-import-jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', 'cron-secret');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 401 when the cron secret is invalid', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/cron/process-import-jobs')
    );

    expect(response.status).toBe(401);
  });

  it('accepts bearer-authenticated cron requests and processes the queue', async () => {
    vi.mocked(processImportJobQueue).mockResolvedValue([
      { id: 'job-1', status: 'completed', processed: 2 },
    ]);

    const response = await GET(
      new NextRequest('http://localhost/api/cron/process-import-jobs', {
        headers: {
          authorization: 'Bearer cron-secret',
        },
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      processed: 1,
      results: [{ id: 'job-1', status: 'completed', processed: 2 }],
    });
    expect(createServiceClient).toHaveBeenCalledTimes(1);
  });

  it('also supports the legacy x-cron-secret header on POST requests', async () => {
    vi.mocked(processImportJobQueue).mockResolvedValue([]);

    const response = await POST(
      new NextRequest('http://localhost/api/cron/process-import-jobs', {
        method: 'POST',
        headers: {
          'x-cron-secret': 'cron-secret',
        },
      })
    );

    expect(response.status).toBe(200);
  });

  it('returns 500 when queue processing fails', async () => {
    vi.mocked(processImportJobQueue).mockRejectedValueOnce(new Error('boom'));

    const response = await GET(
      new NextRequest('http://localhost/api/cron/process-import-jobs', {
        headers: {
          authorization: 'Bearer cron-secret',
        },
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Internal server error',
      code: 'internal_error',
    });
  });
});
