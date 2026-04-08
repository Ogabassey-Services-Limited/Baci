import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => ({
  getImportJobWorkerBatchSize: vi.fn(() => 3),
  getImportJobWorkerSecret: vi.fn(() => 'worker-secret'),
}));

vi.mock('@/lib/import-jobs/process-import-job', () => ({
  processImportJobById: vi.fn(),
  processImportJobQueue: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({ service: true })),
}));

import {
  processImportJobById,
  processImportJobQueue,
} from '@/lib/import-jobs/process-import-job';
import { createServiceClient } from '@/lib/supabase/service';
import { maxDuration, POST } from './route';

describe('POST /api/import-jobs/worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('processes a specific job when jobId is provided', async () => {
    const jobId = 'ece4d914-7cc9-443c-9770-342515ecffe7';
    vi.mocked(processImportJobById).mockResolvedValueOnce({
      id: 'job-1',
      status: 'preview_ready',
      processed: 3,
    });

    const response = await POST(
      new NextRequest('http://localhost/api/import-jobs/worker', {
        method: 'POST',
        headers: {
          authorization: 'Bearer worker-secret',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ jobId }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      processed: 1,
      results: [{ id: 'job-1', status: 'preview_ready', processed: 3 }],
    });
    expect(createServiceClient).toHaveBeenCalledTimes(1);
    expect(processImportJobById).toHaveBeenCalledWith({ service: true }, jobId);
    expect(processImportJobQueue).not.toHaveBeenCalled();
  });

  it('returns 400 when the targeted jobId is invalid', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/import-jobs/worker', {
        method: 'POST',
        headers: {
          authorization: 'Bearer worker-secret',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ jobId: 'not-a-uuid' }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid worker request body',
      code: 'invalid_request',
    });
    expect(createServiceClient).not.toHaveBeenCalled();
    expect(processImportJobById).not.toHaveBeenCalled();
    expect(processImportJobQueue).not.toHaveBeenCalled();
  });

  it('returns 400 when the request body is whitespace only', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/import-jobs/worker', {
        method: 'POST',
        headers: {
          authorization: 'Bearer worker-secret',
          'content-type': 'application/json',
        },
        body: '   ',
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid worker request body',
      code: 'invalid_request',
    });
    expect(createServiceClient).not.toHaveBeenCalled();
    expect(processImportJobById).not.toHaveBeenCalled();
    expect(processImportJobQueue).not.toHaveBeenCalled();
  });

  it('returns 500 when targeted job processing fails', async () => {
    const jobId = 'ece4d914-7cc9-443c-9770-342515ecffe7';
    vi.mocked(processImportJobById).mockRejectedValueOnce(new Error('boom'));

    const response = await POST(
      new NextRequest('http://localhost/api/import-jobs/worker', {
        method: 'POST',
        headers: {
          authorization: 'Bearer worker-secret',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ jobId }),
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Internal server error',
      code: 'internal_error',
    });
    expect(createServiceClient).toHaveBeenCalledTimes(1);
    expect(processImportJobById).toHaveBeenCalledWith({ service: true }, jobId);
    expect(processImportJobQueue).not.toHaveBeenCalled();
  });

  it('returns 500 when queue processing fails', async () => {
    vi.mocked(processImportJobQueue).mockRejectedValueOnce(new Error('boom'));

    const response = await POST(
      new NextRequest('http://localhost/api/import-jobs/worker', {
        method: 'POST',
        headers: {
          authorization: 'Bearer worker-secret',
        },
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Internal server error',
      code: 'internal_error',
    });
    expect(createServiceClient).toHaveBeenCalledTimes(1);
  });

  it('exports a long maxDuration for import processing', () => {
    expect(maxDuration).toBe(300);
  });
});
