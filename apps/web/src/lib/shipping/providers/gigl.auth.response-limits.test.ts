import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  baseUrl,
  jsonResponse,
  loginResponseWithoutCustomerType,
} from './gigl.test-helpers';

function activeToken() {
  return {
    token: 'expired-token',
    userChannelCode: 'channel',
    customerType: 1,
    expiresAt: Date.now() + 60_000,
  };
}

describe('GiglApiClient response limits', () => {
  beforeEach(() => {
    process.env.GIGL_BASE_URL = baseUrl;
    process.env.GIGL_EMAIL = 'test@example.com';
    process.env.GIGL_PASSWORD = 'test-password';
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.GIGL_BASE_URL;
    delete process.env.GIGL_EMAIL;
    delete process.env.GIGL_PASSWORD;
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('bounds and cancels an oversized response after an envelope token refresh', async () => {
    const onCancel = vi.fn();
    const oversizedRetry = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode('{"payload":"x'.repeat(24))
          );
        },
        cancel: onCancel,
      })
    );
    const safeFetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ data: { success: false, message: 'Invalid token' } })
      )
      .mockResolvedValueOnce(jsonResponse(loginResponseWithoutCustomerType))
      .mockResolvedValueOnce(oversizedRetry);
    const { GiglApiClient } = await import('./gigl.auth');
    const client = new GiglApiClient({ log: vi.fn(), safeFetch });

    await expect(
      client.safeFetchEnvelopeWithAccessToken(
        `${baseUrl}/price`,
        activeToken(),
        () => ({ method: 'POST' }),
        { maxResponseBytes: 64 }
      )
    ).rejects.toThrow('GIGL response exceeds maximum size');
    expect(safeFetch).toHaveBeenCalledTimes(3);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('bounds response body reads with the request timeout', async () => {
    vi.useFakeTimers();
    const stalledResponse = new Response(
      new ReadableStream<Uint8Array>({
        pull() {
          return new Promise<void>(() => undefined);
        },
      })
    );
    const safeFetch = vi.fn().mockResolvedValue(stalledResponse);
    const { GiglApiClient } = await import('./gigl.auth');
    const client = new GiglApiClient({ log: vi.fn(), safeFetch });

    const request = client.safeFetchEnvelopeWithAccessToken(
      `${baseUrl}/track/multipleMobileShipment`,
      activeToken(),
      () => ({ method: 'POST', timeout: 25 }),
      { maxResponseBytes: 64 }
    );
    const rejection = expect(request).rejects.toThrow(
      'GIGL response body timed out'
    );

    await vi.advanceTimersByTimeAsync(25);
    await rejection;
  });
});
