import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithCsrf } from '@/lib/api-client';
import * as csrf from '@/lib/csrf';

describe('fetchWithCsrf', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds CSRF header for state-changing methods when token exists', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}'));
    vi.spyOn(csrf, 'getClientCsrfToken').mockReturnValue('csrf-token-value');

    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      await fetchWithCsrf('/api/example', { method });

      const call = fetchSpy.mock.calls.at(-1);
      const init = call?.[1];
      const headers = new Headers(init?.headers);
      expect(headers.get(csrf.CSRF_HEADER_NAME)).toBe('csrf-token-value');
    }
  });

  it('initializes a CSRF token before state-changing requests when token is missing', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input) => {
        if (input === '/api/csrf') {
          return Promise.resolve(new Response('{}', { status: 200 }));
        }

        return Promise.resolve(new Response('{}'));
      });
    const tokenSpy = vi
      .spyOn(csrf, 'getClientCsrfToken')
      .mockReturnValueOnce(null)
      .mockReturnValueOnce('fresh-token');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Intentionally suppress warning output during this assertion.
    });

    await fetchWithCsrf('/api/example', { method: 'POST' });

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      '/api/csrf',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
      })
    );

    const init = fetchSpy.mock.calls[1]?.[1];
    const headers = new Headers(init?.headers);
    expect(headers.get(csrf.CSRF_HEADER_NAME)).toBe('fresh-token');
    expect(tokenSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('never adds CSRF header for GET requests', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}'));
    vi.spyOn(csrf, 'getClientCsrfToken').mockReturnValue('csrf-token-value');

    await fetchWithCsrf('/api/example', { method: 'GET' });

    const init = fetchSpy.mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);
    expect(headers.get(csrf.CSRF_HEADER_NAME)).toBeNull();
  });

  it('defaults to GET and does not add CSRF header when method is omitted', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}'));
    vi.spyOn(csrf, 'getClientCsrfToken').mockReturnValue('csrf-token-value');

    await fetchWithCsrf('/api/example');

    const init = fetchSpy.mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);
    expect(headers.get(csrf.CSRF_HEADER_NAME)).toBeNull();
  });

  it('does not set content-type when body is FormData', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}'));
    vi.spyOn(csrf, 'getClientCsrfToken').mockReturnValue('csrf-token-value');

    const formData = new FormData();
    formData.append('file', new Blob(['test']), 'test.jpg');

    await fetchWithCsrf('/api/upload', {
      method: 'POST',
      body: formData,
    });

    const init = fetchSpy.mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);
    expect(headers.get('content-type')).toBeNull();
  });

  it('sets content-type to application/json for stringified JSON body', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}'));
    vi.spyOn(csrf, 'getClientCsrfToken').mockReturnValue('csrf-token-value');

    await fetchWithCsrf('/api/example', {
      method: 'POST',
      body: JSON.stringify({ key: 'value' }),
    });

    const init = fetchSpy.mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);
    expect(headers.get('content-type')).toBe('application/json');
  });

  it('retries once after an invalid CSRF response', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input, init) => {
        if (input === '/api/csrf') {
          return Promise.resolve(new Response('{}', { status: 200 }));
        }

        const headers = new Headers(init?.headers);
        const csrfHeader = headers.get(csrf.CSRF_HEADER_NAME);

        if (csrfHeader === 'stale-token') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                error: 'Invalid CSRF token',
                message: 'CSRF token validation failed.',
              }),
              {
                status: 403,
                headers: { 'Content-Type': 'application/json' },
              }
            )
          );
        }

        return Promise.resolve(new Response('{}', { status: 200 }));
      });

    vi.spyOn(csrf, 'getClientCsrfToken')
      .mockReturnValueOnce('stale-token')
      .mockReturnValueOnce('fresh-token');

    const response = await fetchWithCsrf('/api/example', { method: 'PATCH' });

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    const firstRequestHeaders = new Headers(
      fetchSpy.mock.calls[0]?.[1]?.headers
    );
    expect(firstRequestHeaders.get(csrf.CSRF_HEADER_NAME)).toBe('stale-token');

    const secondRequestHeaders = new Headers(
      fetchSpy.mock.calls[2]?.[1]?.headers
    );
    expect(secondRequestHeaders.get(csrf.CSRF_HEADER_NAME)).toBe('fresh-token');
  });
});
