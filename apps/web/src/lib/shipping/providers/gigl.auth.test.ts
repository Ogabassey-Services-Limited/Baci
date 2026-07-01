import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  baseUrl,
  jsonResponse,
  loginResponseWithoutCustomerType,
  quoteRequest,
  stationsResponse,
} from './gigl.test-helpers';

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
});
