import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  abortingFetchResponse,
  baseUrl,
  jsonResponse,
  loginResponseWithoutCustomerType,
  quoteRequest,
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

  it('preserves quote timeout when sharing an existing token request', async () => {
    process.env.GIGL_QUOTE_TIMEOUT_MS = '25';
    vi.resetModules();
    vi.useFakeTimers();
    const fetchMock = vi.fn(abortingFetchResponse);
    vi.stubGlobal('fetch', fetchMock);

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();

    const locationsPromise = provider
      .getLocations()
      .catch((error: unknown) =>
        error instanceof Error ? error.name : String(error)
      );
    const quotePromise = provider.getQuotes(quoteRequest);

    await vi.advanceTimersByTimeAsync(25);

    await expect(quotePromise).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(30_000);

    await expect(locationsPromise).resolves.toContain('AbortError');
  });
});
