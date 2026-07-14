import { afterEach, describe, expect, it, vi } from 'vitest';
import { facebookCAPI, sendFacebookCAPIEvent } from './facebook-capi';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('sendFacebookCAPIEvent', () => {
  it('enables Limited Data Use for every helper when it is appended after existing arguments', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ events_received: 1 }),
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);

    await facebookCAPI.initiateCheckout(
      'pixel-1',
      'token-1',
      {},
      100,
      'NGN',
      [{ id: 'sku-checkout', quantity: 1 }],
      undefined,
      'checkout-event',
      undefined,
      1_783_857_600,
      true
    );
    await facebookCAPI.addToCart(
      'pixel-1',
      'token-1',
      {},
      'sku-cart',
      'Cart product',
      100,
      'NGN',
      undefined,
      'cart-event',
      undefined,
      1_783_857_600,
      true
    );
    await facebookCAPI.viewContent(
      'pixel-1',
      'token-1',
      {},
      'sku-content',
      'Content product',
      100,
      'NGN',
      undefined,
      undefined,
      'content-event',
      undefined,
      1_783_857_600,
      true
    );

    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [, request] of fetchMock.mock.calls) {
      const body = JSON.parse((request as RequestInit).body as string);
      expect(body).toMatchObject({
        data: [expect.objectContaining({ opt_out: true })],
        data_processing_options: ['LDU'],
        data_processing_options_country: 1,
        data_processing_options_state: 1000,
      });
    }
  });

  it('passes the caller abort signal to fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ events_received: 1 }),
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await sendFacebookCAPIEvent(
      'pixel-1',
      'token-1',
      'PageView',
      {},
      undefined,
      'https://example.com',
      'event-1',
      false,
      controller.signal
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal })
    );
  });

  it('returns a sanitized provider rejection', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          error: { message: 'Invalid access token' },
        }),
        ok: false,
        status: 401,
      })
    );

    const result = await sendFacebookCAPIEvent(
      'pixel-1',
      'token-1',
      'PageView',
      {}
    );

    expect(result).toEqual({
      error: 'Invalid access token',
      httpStatus: 401,
      success: false,
    });
  });

  it('returns a network failure without throwing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const result = await sendFacebookCAPIEvent(
      'pixel-1',
      'token-1',
      'PageView',
      {}
    );

    expect(result).toEqual({ error: 'offline', success: false });
  });
});
