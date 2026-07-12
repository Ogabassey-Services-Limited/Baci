import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendSnapchatEvent } from './snapchat-capi';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('sendSnapchatEvent', () => {
  it('passes the caller abort signal to fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await sendSnapchatEvent(
      'pixel-1',
      'token-1',
      'VIEW_CONTENT',
      {},
      {},
      'event-1',
      controller.signal
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal })
    );
  });

  it('returns a deterministic provider rejection', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        text: vi.fn().mockResolvedValue('invalid access token'),
      })
    );

    const result = await sendSnapchatEvent(
      'pixel-1',
      'token-1',
      'VIEW_CONTENT',
      {}
    );

    expect(result).toEqual({ error: 'invalid access token', success: false });
  });
});
