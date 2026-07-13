import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendFacebookCAPIEvent } from './facebook-capi';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('sendFacebookCAPIEvent', () => {
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
