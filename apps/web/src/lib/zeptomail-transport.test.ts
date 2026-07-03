import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { zeptoMailRequest } from './zeptomail-transport';

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('zeptoMailRequest', () => {
  it('POSTs the payload to the v1.1 endpoint with the raw token as Authorization', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ request_id: 'req-1', message: 'OK' })
    );

    const payload = { subject: 'Hello', htmlbody: '<p>Hi</p>' };
    const result = await zeptoMailRequest(
      'email',
      payload,
      'Zoho-enczapikey secret-token'
    );

    expect(result).toEqual({ request_id: 'req-1', message: 'OK' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.zeptomail.com/v1.1/email');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify(payload));
    expect(init.headers).toMatchObject({
      Authorization: 'Zoho-enczapikey secret-token',
      'Content-Type': 'application/json',
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    ['email/template', 'https://api.zeptomail.com/v1.1/email/template'],
    [
      'email/template/batch',
      'https://api.zeptomail.com/v1.1/email/template/batch',
    ],
  ] as const)('routes the %s endpoint to %s', async (endpoint, expectedUrl) => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ request_id: 'req-2' }));

    await zeptoMailRequest(endpoint, {}, 'token');

    expect(fetchMock.mock.calls[0]?.[0]).toBe(expectedUrl);
  });

  it('rejects with the parsed ZeptoMail error body on a non-2xx JSON response', async () => {
    const errorBody = {
      error: { code: 'TM_4001', message: 'Invalid API token', details: [] },
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(errorBody, 401));

    await expect(zeptoMailRequest('email', {}, 'bad-token')).rejects.toEqual(
      errorBody
    );
  });

  it('rejects with an HTTP-status Error when a non-2xx response has no JSON body', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('Bad Gateway', { status: 502 })
    );

    await expect(zeptoMailRequest('email', {}, 'token')).rejects.toThrow(
      'ZeptoMail request failed with HTTP 502'
    );
  });

  it('returns an empty response object when a 2xx response has no JSON body', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(zeptoMailRequest('email', {}, 'token')).resolves.toEqual({});
  });

  it('merges the undici cause into network failure messages', async () => {
    const failure = new TypeError('fetch failed');
    (failure as TypeError & { cause?: Error }).cause = new Error(
      'getaddrinfo ENOTFOUND api.zeptomail.com'
    );
    fetchMock.mockRejectedValueOnce(failure);

    await expect(zeptoMailRequest('email', {}, 'token')).rejects.toThrow(
      'fetch failed: getaddrinfo ENOTFOUND api.zeptomail.com'
    );
  });

  it('rethrows plain Error network failures unchanged', async () => {
    fetchMock.mockRejectedValueOnce(new Error('socket hang up'));

    await expect(zeptoMailRequest('email', {}, 'token')).rejects.toThrow(
      'socket hang up'
    );
  });

  it('wraps non-Error rejections in an Error', async () => {
    fetchMock.mockRejectedValueOnce('boom');

    await expect(zeptoMailRequest('email', {}, 'token')).rejects.toThrow(
      'boom'
    );
  });
});
