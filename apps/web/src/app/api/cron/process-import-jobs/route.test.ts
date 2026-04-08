import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => ({
  getCronSecret: vi.fn(() => 'cron-secret'),
  getImportJobWorkerBatchSize: vi.fn(() => 3),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(),
}));

vi.mock('@/lib/import-jobs/process-import-job', () => ({
  processImportJobQueue: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({ service: true })),
}));

import { checkCsrfProtection } from '@/lib/csrf';
import { processImportJobQueue } from '@/lib/import-jobs/process-import-job';
import { createServiceClient } from '@/lib/supabase/service';
import { GET, maxDuration, POST } from './route';

describe('/api/cron/process-import-jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkCsrfProtection).mockResolvedValue({ valid: true });
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
      statusCounts: { completed: 1 },
    });
    expect(createServiceClient).toHaveBeenCalledTimes(1);
  });

  it('returns 403 for legacy x-cron-secret POST requests without a CSRF token', async () => {
    vi.mocked(checkCsrfProtection).mockResolvedValue({
      valid: false,
      response: new Response(JSON.stringify({ error: 'Invalid CSRF token' }), {
        status: 403,
      }) as never,
    });

    const response = await POST(
      new NextRequest('http://localhost/api/cron/process-import-jobs', {
        method: 'POST',
        headers: {
          'x-cron-secret': 'cron-secret',
        },
      })
    );

    expect(response.status).toBe(403);
  });

  it('accepts POST requests with x-cron-secret when CSRF validation succeeds', async () => {
    vi.mocked(processImportJobQueue).mockResolvedValue([]);

    const response = await POST(
      new NextRequest('http://localhost/api/cron/process-import-jobs', {
        method: 'POST',
        headers: {
          'x-cron-secret': 'cron-secret',
          'x-csrf-token': 'token',
          cookie: 'csrf-token=token',
        },
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      processed: 0,
      statusCounts: {},
    });
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

  it('exports a long maxDuration for queue rescue runs', () => {
    expect(maxDuration).toBe(300);
  });
});
