import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJson, fetchText } from './webmcp-storefront-tools-fetch';

const originalFetch = global.fetch;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('webmcp-storefront-tools-fetch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('returns parsed JSON for successful same-origin requests', async () => {
    const signal = new AbortController().signal;
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    global.fetch = fetchMock as typeof fetch;

    await expect(
      fetchJson<{ ok: boolean }>('/api/data', signal)
    ).resolves.toEqual({
      ok: true,
      data: { ok: true },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/data',
      expect.objectContaining({
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal,
      })
    );
  });

  it('returns structured errors for non-OK and rejected JSON requests', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 503 })
      ) as typeof fetch;

    await expect(fetchJson('/api/data')).resolves.toEqual({
      ok: false,
      error: 'Request failed with status 503',
      status: 503,
    });

    global.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline')) as typeof fetch;
    await expect(fetchJson('/api/data')).resolves.toEqual({
      ok: false,
      error: 'offline',
      status: 0,
    });
  });

  it('catches text stream decode failures and returns null', async () => {
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.reject(new Error('decode failed')),
    }) as unknown as typeof fetch;

    await expect(fetchText('/auth.md')).resolves.toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      '[WebMCP] Failed to fetch text document',
      expect.objectContaining({ url: '/auth.md' })
    );
  });
});
