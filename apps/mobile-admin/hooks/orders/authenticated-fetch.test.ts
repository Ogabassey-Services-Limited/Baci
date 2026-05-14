import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  getSession: vi.fn(),
}));

vi.stubGlobal('fetch', mocks.fetch);

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
    },
  },
}));

import { createAuthenticatedFetch } from './authenticated-fetch';

describe('createAuthenticatedFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ data: { session: null } });
  });

  it('throws auth session errors before fetching', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-1' } },
      error: { message: 'Session lookup failed' },
    });

    await expect(
      createAuthenticatedFetch('https://example.test/api', {}, 1000)
    ).rejects.toThrow('Session lookup failed');
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('throws when no session token is available', async () => {
    await expect(
      createAuthenticatedFetch('https://example.test/api', {}, 1000)
    ).rejects.toThrow('Not authenticated');
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('adds the bearer token and timeout signal to fetch requests', async () => {
    const response = new Response(JSON.stringify({ ok: true }));
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-1' } },
    });
    mocks.fetch.mockResolvedValue(response);

    await expect(
      createAuthenticatedFetch(
        'https://example.test/api',
        {
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'POST',
        },
        1000
      )
    ).resolves.toBe(response);

    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://example.test/api',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-1',
          'Content-Type': 'application/json',
        }),
        method: 'POST',
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('maps AbortError failures to the shared timeout message', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-1' } },
    });
    mocks.fetch.mockRejectedValue(abortError);

    await expect(
      createAuthenticatedFetch('https://example.test/api', {}, 1000)
    ).rejects.toThrow(
      'Request timed out. Please check your connection and try again.'
    );
  });

  it('aborts the internal fetch signal when the caller signal aborts', async () => {
    const callerController = new AbortController();
    const response = new Response(JSON.stringify({ ok: true }));
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-1' } },
    });
    mocks.fetch.mockImplementation((_url, options: RequestInit) => {
      callerController.abort();
      expect(options.signal?.aborted).toBe(true);
      return Promise.resolve(response);
    });

    await expect(
      createAuthenticatedFetch(
        'https://example.test/api',
        { signal: callerController.signal },
        1000
      )
    ).resolves.toBe(response);
  });
});
