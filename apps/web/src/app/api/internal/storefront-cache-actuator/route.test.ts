import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getStorefrontCacheActuatorRequestBodySha256 } from '@/lib/events/storefront-cache-actuator-auth';

const mocks = vi.hoisted(() => ({
  barrier: vi.fn<
    (...args: unknown[]) => Promise<{ ok: boolean; reason?: string }>
  >(async () => ({ ok: true })),
}));

vi.mock('@/lib/storefront-category-cache-barrier', () => ({
  runStorefrontCategoryCacheBarrier: mocks.barrier,
}));

import { POST } from './route';

const secret = 'storefront-cache-actuator-test-secret';
const merchantId = '11111111-1111-4111-8111-111111111111';
const requestBody = {
  schemaVersion: 1,
  obligationId: '22222222-2222-4222-8222-222222222222',
  generation: 4,
  merchantId,
  previousSlug: 'phones',
  nextSlug: 'smartphones',
  relatedSlugs: ['audio'],
};
const originalSecret = process.env.STOREFRONT_CACHE_ACTUATOR_SECRET;
const originalCanaryMerchantId =
  process.env.STOREFRONT_CACHE_CANARY_MERCHANT_ID;

function signedRequest(body = JSON.stringify(requestBody)): Request {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const digest = getStorefrontCacheActuatorRequestBodySha256(body);
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}\n${digest}`, 'utf8')
    .digest('hex');
  return new Request(
    'https://baci.test/api/internal/storefront-cache-actuator',
    {
      body,
      headers: {
        'content-type': 'application/json',
        'x-baci-storefront-cache-signature': `v1=${signature}`,
        'x-baci-storefront-cache-timestamp': timestamp,
      },
      method: 'POST',
    }
  );
}

describe('POST /api/internal/storefront-cache-actuator', () => {
  beforeEach(() => {
    process.env.STOREFRONT_CACHE_ACTUATOR_SECRET = secret;
    process.env.STOREFRONT_CACHE_CANARY_MERCHANT_ID = merchantId;
    mocks.barrier.mockReset().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.STOREFRONT_CACHE_ACTUATOR_SECRET;
    } else {
      process.env.STOREFRONT_CACHE_ACTUATOR_SECRET = originalSecret;
    }
    if (originalCanaryMerchantId === undefined) {
      delete process.env.STOREFRONT_CACHE_CANARY_MERCHANT_ID;
    } else {
      process.env.STOREFRONT_CACHE_CANARY_MERCHANT_ID =
        originalCanaryMerchantId;
    }
  });

  it('rejects unsigned input before it reaches the barrier', async () => {
    const response = await POST(
      new Request('https://baci.test/api/internal/storefront-cache-actuator', {
        body: JSON.stringify(requestBody),
        method: 'POST',
      })
    );

    expect(response.status).toBe(401);
    expect(mocks.barrier).not.toHaveBeenCalled();
  });

  it('authenticates malformed JSON before rejecting it as invalid input', async () => {
    const response = await POST(signedRequest('{'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Invalid cache transition request',
      ok: false,
    });
    expect(mocks.barrier).not.toHaveBeenCalled();
  });

  it('returns an exact request-bound receipt only after the full barrier succeeds', async () => {
    const rawBody = JSON.stringify(requestBody);
    const response = await POST(signedRequest(rawBody));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.barrier).toHaveBeenCalledWith({
      canaryMerchantId: merchantId,
      merchantId,
      nextSlug: 'smartphones',
      previousSlug: 'phones',
      relatedSlugs: ['audio'],
    });
    expect(payload).toEqual({
      ok: true,
      receipt: {
        completedAt: expect.any(String),
        generation: 4,
        obligationId: requestBody.obligationId,
        requestBodySha256: getStorefrontCacheActuatorRequestBodySha256(rawBody),
        schemaVersion: 1,
      },
    });
  });

  it('fails closed when the bounded barrier cannot complete', async () => {
    mocks.barrier.mockResolvedValue({
      ok: false,
      reason: 'vercel_purge_failed',
    });

    const response = await POST(signedRequest());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'Storefront cache barrier unavailable',
      ok: false,
    });
  });

  it('fails closed when the barrier unexpectedly throws', async () => {
    mocks.barrier.mockRejectedValue(new Error('unexpected provider failure'));

    const response = await POST(signedRequest());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'Storefront cache barrier unavailable',
      ok: false,
    });
  });
});
