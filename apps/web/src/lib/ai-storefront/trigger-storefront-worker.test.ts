import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAiStorefrontWorkerTriggerSecret: vi.fn(),
  getAiStorefrontWorkerTriggerTimeoutMs: vi.fn(),
  getAiStorefrontWorkerTriggerUrl: vi.fn(),
}));

vi.mock('@/env', () => ({
  getAiStorefrontWorkerTriggerSecret: mocks.getAiStorefrontWorkerTriggerSecret,
  getAiStorefrontWorkerTriggerTimeoutMs:
    mocks.getAiStorefrontWorkerTriggerTimeoutMs,
  getAiStorefrontWorkerTriggerUrl: mocks.getAiStorefrontWorkerTriggerUrl,
}));

import { triggerAiStorefrontWorker } from './trigger-storefront-worker';

describe('triggerAiStorefrontWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAiStorefrontWorkerTriggerUrl.mockReturnValue(
      'https://workers.ogabassey.com/ai-storefront/trigger'
    );
    mocks.getAiStorefrontWorkerTriggerSecret.mockReturnValue('trigger-secret');
    mocks.getAiStorefrontWorkerTriggerTimeoutMs.mockReturnValue(5000);
  });

  it('skips the trigger when the endpoint is not configured', async () => {
    const fetchFn = vi.fn();
    mocks.getAiStorefrontWorkerTriggerUrl.mockReturnValue(undefined);

    const result = await triggerAiStorefrontWorker({
      fetchFn,
      merchantId: 'merchant-1',
      source: 'api',
    });

    expect(result).toEqual({ triggered: false, reason: 'not_configured' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('skips the trigger when the endpoint secret is not configured', async () => {
    const fetchFn = vi.fn();
    mocks.getAiStorefrontWorkerTriggerSecret.mockReturnValue(undefined);

    const result = await triggerAiStorefrontWorker({
      fetchFn,
      merchantId: 'merchant-1',
      source: 'api',
    });

    expect(result).toEqual({ triggered: false, reason: 'not_configured' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('posts a signed storefront trigger payload to the VPS', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(new Response('accepted', { status: 202 }));

    const result = await triggerAiStorefrontWorker({
      fetchFn,
      jobId: 'job-1',
      merchantId: 'merchant-1',
      source: 'api',
    });

    expect(result).toEqual({ triggered: true, status: 202 });
    expect(fetchFn).toHaveBeenCalledWith(
      'https://workers.ogabassey.com/ai-storefront/trigger',
      expect.objectContaining({
        method: 'POST',
        headers: {
          authorization: 'Bearer trigger-secret',
          'content-type': 'application/json',
          'user-agent': 'baci-web-ai-storefront-trigger/1.0',
        },
        body: JSON.stringify({
          jobId: 'job-1',
          merchantId: 'merchant-1',
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
      triggerAiStorefrontWorker({
        fetchFn,
        merchantId: 'merchant-1',
        source: 'onboarding',
      })
    ).rejects.toThrow(
      'AI storefront worker trigger failed with HTTP 401 Unauthorized: bad token'
    );
  });

  it('throws network failures from the trigger request', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('Network failure'));

    await expect(
      triggerAiStorefrontWorker({
        fetchFn,
        merchantId: 'merchant-1',
        source: 'api',
      })
    ).rejects.toThrow('Network failure');
  });

  it('throws abort failures from the trigger request', async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValue(
        new DOMException('The operation was aborted', 'AbortError')
      );

    await expect(
      triggerAiStorefrontWorker({
        fetchFn,
        merchantId: 'merchant-1',
        source: 'api',
      })
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it.each([
    500, 503,
  ])('includes response context for HTTP %s trigger failures', async (status) => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response('worker unavailable', {
        status,
        statusText: 'Service Error',
      })
    );

    await expect(
      triggerAiStorefrontWorker({
        fetchFn,
        merchantId: 'merchant-1',
        source: 'api',
      })
    ).rejects.toThrow(
      `AI storefront worker trigger failed with HTTP ${status} Service Error: worker unavailable`
    );
  });

  it('truncates long trigger failure bodies', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response('x'.repeat(600), {
        status: 500,
        statusText: 'Service Error',
      })
    );

    await expect(
      triggerAiStorefrontWorker({
        fetchFn,
        merchantId: 'merchant-1',
        source: 'api',
      })
    ).rejects.toThrow(`${'x'.repeat(500)}...`);
  });
});
