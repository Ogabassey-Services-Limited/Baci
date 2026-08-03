import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  baseUrl,
  jsonResponse,
  loginResponseWithoutCustomerType,
  quoteRequest,
  stationsResponse,
} from './gigl.test-helpers';

function activeToken() {
  return {
    token: 'expired-token',
    userChannelCode: 'channel',
    customerType: 1,
    expiresAt: Date.now() + 60_000,
  };
}

describe('GiglProvider authentication and configuration', () => {
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
    delete process.env.GIGL_QUOTE_TIMEOUT_MS;
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it('rejects unsuccessful login envelopes before parsing login data', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: {
          message: 'Invalid credentials',
          status: 401,
          data: {},
        },
      })
    );
    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();
    await expect(provider.getLocations()).rejects.toThrow(
      'Invalid GIGL login response'
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('deduplicates concurrent token requests', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(jsonResponse(loginResponseWithoutCustomerType));

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();
    await expect(
      Promise.all([provider.isAvailable(), provider.isAvailable()])
    ).resolves.toEqual([true, true]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${baseUrl}/login`);
  });
  it('does not call GIGL when credentials are missing', async () => {
    delete process.env.GIGL_EMAIL;
    delete process.env.GIGL_PASSWORD;
    vi.resetModules();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();
    await expect(provider.getQuotes(quoteRequest)).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('requires an explicit base URL for production deployments', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.GIGL_BASE_URL;
    vi.resetModules();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();

    await expect(provider.isAvailable()).resolves.toBe(false);
    await expect(provider.getQuotes(quoteRequest)).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('observes late token refresh failures after caller timeout', async () => {
    process.env.GIGL_QUOTE_TIMEOUT_MS = '25';
    vi.resetModules();
    vi.useFakeTimers();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const lateFailure = new Error('late login failure');
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((_resolve, reject) => {
          setTimeout(() => reject(lateFailure), 50);
        })
    );

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();

    try {
      const quotePromise = provider.getQuotes(quoteRequest);
      await vi.advanceTimersByTimeAsync(25);
      await expect(quotePromise).resolves.toEqual([]);
      await vi.advanceTimersByTimeAsync(25);
      await Promise.resolve();

      expect(unhandled).toEqual([]);
    } finally {
      process.removeListener('unhandledRejection', onUnhandled);
    }
  });
  it('keeps shared token refresh independent of a quote timeout', async () => {
    process.env.GIGL_QUOTE_TIMEOUT_MS = '25';
    vi.resetModules();
    vi.useFakeTimers();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            setTimeout(
              () => resolve(jsonResponse(loginResponseWithoutCustomerType)),
              50
            );
          })
      )
      .mockResolvedValueOnce(jsonResponse(stationsResponse));

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();

    const quotePromise = provider.getQuotes(quoteRequest);
    const locationsPromise = provider.getLocations();
    await vi.advanceTimersByTimeAsync(25);
    await expect(quotePromise).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(25);
    await expect(locationsPromise).resolves.toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('redacts failed GIGL login bodies from logs', async () => {
    const onCancel = vi
      .fn()
      .mockRejectedValue(new Error('stream cleanup failed'));
    const loginResponse = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode('credential details must stay private')
          );
        },
        cancel: onCancel,
      }),
      { status: 401 }
    );
    const readBody = vi.spyOn(loginResponse, 'text');
    const log = vi.fn();
    const safeFetch = vi.fn().mockResolvedValue(loginResponse);
    const { GiglApiClient } = await import('./gigl.auth');
    const client = new GiglApiClient({ log, safeFetch });
    await expect(client.getApiToken()).rejects.toThrow(
      'GIGL API authentication failed'
    );

    expect(readBody).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith('error', 'GIGL login failed', {
      code: 'gigl_login_http_error',
      status: 401,
    });
  });
  it('redacts provider messages from invalid GIGL login envelopes', async () => {
    const log = vi.fn();
    const safeFetch = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          data: {},
          message: 'credential details must stay private',
          status: 401,
        },
      })
    );
    const { GiglApiClient } = await import('./gigl.auth');
    const client = new GiglApiClient({ log, safeFetch });
    await expect(client.getApiToken()).rejects.toThrow(
      'Invalid GIGL login response'
    );
    expect(log).toHaveBeenCalledWith('warn', 'Invalid GIGL login response', {
      code: 'gigl_invalid_login_envelope',
      status: 401,
    });
  });
  it('logs projected Zod issues without provider response content', async () => {
    const log = vi.fn();
    const { GiglApiClient } = await import('./gigl.auth');
    const { giglSchemas } = await import('./gigl.schemas');
    const client = new GiglApiClient({ log, safeFetch: vi.fn() });
    expect(() =>
      client.parseEnvelopeData(
        {
          data: { 'access-token': '', UserChannelCode: '' },
          message: 'credential details must stay private',
          status: 200,
        },
        giglSchemas.loginData,
        'login'
      )
    ).toThrow('Invalid GIGL login response');
    expect(log).toHaveBeenCalledWith('warn', 'Invalid GIGL login response', {
      code: 'gigl_invalid_response',
      issueCount: 2,
      issues: [
        { code: 'too_small', path: ['access-token'] },
        { code: 'too_small', path: ['UserChannelCode'] },
      ],
      status: 200,
    });
  });
  it('preserves a nested unsuccessful envelope without additional fields', async () => {
    const { GiglApiClient } = await import('./gigl.auth');
    const client = new GiglApiClient({
      log: vi.fn(),
      safeFetch: vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ status: 200, data: { success: false } })
        ),
    });
    const result = await client.safeFetchEnvelopeWithAccessToken(
      `${baseUrl}/price`,
      activeToken(),
      () => ({ method: 'POST' })
    );
    expect(result.envelope).toMatchObject({ status: 200, success: false });
  });
  it('refreshes a token for a nested unsuccessful authentication envelope', async () => {
    const safeFetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          status: 200,
          data: { success: false, message: 'Invalid token' },
        })
      )
      .mockResolvedValueOnce(jsonResponse(loginResponseWithoutCustomerType))
      .mockResolvedValueOnce(jsonResponse({ status: 200, data: { quote: 1 } }));
    const { GiglApiClient } = await import('./gigl.auth');
    const client = new GiglApiClient({ log: vi.fn(), safeFetch });
    const result = await client.safeFetchEnvelopeWithAccessToken(
      `${baseUrl}/price`,
      activeToken(),
      () => ({ method: 'POST' })
    );
    expect(safeFetch).toHaveBeenCalledTimes(3);
    expect(result.envelope).toMatchObject({ status: 200, data: { quote: 1 } });
  });
});
