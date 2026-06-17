import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getImportJobWorkerTriggerSecret: vi.fn(),
  getImportJobWorkerTriggerTimeoutMs: vi.fn(),
  getImportJobWorkerTriggerUrl: vi.fn(),
}));

vi.mock('@/env', () => ({
  getImportJobWorkerTriggerSecret: mocks.getImportJobWorkerTriggerSecret,
  getImportJobWorkerTriggerTimeoutMs: mocks.getImportJobWorkerTriggerTimeoutMs,
  getImportJobWorkerTriggerUrl: mocks.getImportJobWorkerTriggerUrl,
}));

import { triggerImportJobWorker } from './trigger-import-job-worker';

describe('triggerImportJobWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getImportJobWorkerTriggerUrl.mockReturnValue(
      'https://workers.ogabassey.com/import-jobs/trigger'
    );
    mocks.getImportJobWorkerTriggerSecret.mockReturnValue('trigger-secret');
    mocks.getImportJobWorkerTriggerTimeoutMs.mockReturnValue(5000);
  });

  it('skips the trigger when the endpoint is not configured', async () => {
    const fetchFn = vi.fn();
    mocks.getImportJobWorkerTriggerUrl.mockReturnValue(undefined);

    const result = await triggerImportJobWorker({
      fetchFn,
      jobId: '11111111-1111-4111-8111-111111111111',
      source: 'api',
    });

    expect(result).toEqual({ triggered: false, reason: 'not_configured' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('posts a signed import trigger payload to the VPS', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(new Response('accepted', { status: 202 }));

    const result = await triggerImportJobWorker({
      fetchFn,
      jobId: '11111111-1111-4111-8111-111111111111',
      source: 'api',
    });

    expect(result).toEqual({ triggered: true, status: 202 });
    expect(fetchFn).toHaveBeenCalledWith(
      'https://workers.ogabassey.com/import-jobs/trigger',
      expect.objectContaining({
        method: 'POST',
        headers: {
          authorization: 'Bearer trigger-secret',
          'content-type': 'application/json',
          'user-agent': 'baci-web-import-job-trigger/1.0',
        },
        body: JSON.stringify({
          jobId: '11111111-1111-4111-8111-111111111111',
          source: 'api',
        }),
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('throws when the VPS trigger rejects the request', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        new Response('bad token', { status: 401, statusText: 'Unauthorized' })
      );

    await expect(
      triggerImportJobWorker({
        fetchFn,
        jobId: '11111111-1111-4111-8111-111111111111',
        source: 'api',
      })
    ).rejects.toThrow(
      'Import job worker trigger failed with HTTP 401 Unauthorized: bad token'
    );
  });

  it('propagates network and timeout failures from the VPS trigger request', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('operation aborted'));

    await expect(
      triggerImportJobWorker({
        fetchFn,
        jobId: '11111111-1111-4111-8111-111111111111',
        source: 'api',
      })
    ).rejects.toThrow('operation aborted');
  });

  it('truncates long trigger failure bodies', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response('x'.repeat(600), {
        status: 500,
        statusText: 'Service Error',
      })
    );

    await expect(
      triggerImportJobWorker({
        fetchFn,
        jobId: '11111111-1111-4111-8111-111111111111',
        source: 'api',
      })
    ).rejects.toThrow(`${'x'.repeat(500)}...`);
  });
});
