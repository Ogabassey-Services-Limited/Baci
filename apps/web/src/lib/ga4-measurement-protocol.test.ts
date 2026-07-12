import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendGA4Event } from './ga4-measurement-protocol';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('sendGA4Event', () => {
  it('passes the caller abort signal to fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await sendGA4Event(
      'G-TEST',
      'secret',
      'page_view',
      { clientId: 'client-1' },
      {},
      false,
      controller.signal
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal })
    );
  });

  it('returns an HTTP failure without throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 503 })
    );

    const result = await sendGA4Event('G-TEST', 'secret', 'page_view', {
      clientId: 'client-1',
    });

    expect(result).toEqual({ error: 'HTTP 503', success: false });
  });
});
