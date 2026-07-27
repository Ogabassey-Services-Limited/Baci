import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  callStorefrontCacheActuator,
  getStorefrontCacheActuatorRequestBodySha256,
  type StorefrontCacheTransitionActuatorFailure,
} from './storefront-cache-transition-actuator-client';

const originalFetch = globalThis.fetch;
const originalUrl = process.env.STOREFRONT_CACHE_ACTUATOR_URL;
const originalSecret = process.env.STOREFRONT_CACHE_ACTUATOR_SECRET;
const secret = 'cache-actuator-client-test-secret';
const request = {
  generation: 4,
  merchantId: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
  nextSlug: 'smartphones',
  obligationId: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a232',
  previousSlug: 'phones',
  relatedSlugs: ['phones', 'smartphones'],
  schemaVersion: 1 as const,
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined)
    delete process.env.STOREFRONT_CACHE_ACTUATOR_URL;
  else process.env.STOREFRONT_CACHE_ACTUATOR_URL = originalUrl;
  if (originalSecret === undefined)
    delete process.env.STOREFRONT_CACHE_ACTUATOR_SECRET;
  else process.env.STOREFRONT_CACHE_ACTUATOR_SECRET = originalSecret;
});

describe('callStorefrontCacheActuator', () => {
  it('posts the exact request bytes with the dedicated HMAC headers', async () => {
    process.env.STOREFRONT_CACHE_ACTUATOR_URL =
      'https://worker-origin.test/api/internal/storefront-cache-actuator';
    process.env.STOREFRONT_CACHE_ACTUATOR_SECRET = secret;
    const receipt = {
      completedAt: '2026-07-27T12:00:00.000Z',
      generation: request.generation,
      obligationId: request.obligationId,
      requestBodySha256: getStorefrontCacheActuatorRequestBodySha256(
        JSON.stringify(request)
      ),
      schemaVersion: 1,
    };
    globalThis.fetch = vi.fn(async (_input, init) => {
      const timestamp = String(
        new Headers(init?.headers).get('x-baci-storefront-cache-timestamp')
      );
      const digest = getStorefrontCacheActuatorRequestBodySha256(
        String(init?.body)
      );
      const expected = createHmac('sha256', secret)
        .update(`${timestamp}\n${digest}`, 'utf8')
        .digest('hex');
      expect(
        new Headers(init?.headers).get('x-baci-storefront-cache-signature')
      ).toBe(`v1=${expected}`);
      return Response.json({ ok: true, receipt });
    });

    await expect(callStorefrontCacheActuator(request)).resolves.toEqual(
      receipt
    );
  });

  it('fails closed before transport when the actuator URL is not HTTPS', async () => {
    process.env.STOREFRONT_CACHE_ACTUATOR_URL =
      'http://worker-origin.test/cache';
    process.env.STOREFRONT_CACHE_ACTUATOR_SECRET = secret;

    await expect(callStorefrontCacheActuator(request)).rejects.toEqual(
      expect.objectContaining<
        Partial<StorefrontCacheTransitionActuatorFailure>
      >({
        code: 'actuator_configuration_invalid',
      })
    );
    expect(globalThis.fetch).toBe(originalFetch);
  });
});
