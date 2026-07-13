import {
  ApiError,
  fetchJsonWithRetry,
  fetchWithRetry,
  RetryExhaustedError,
} from './api-core';
import { fetchWithTimeout } from './fetch-with-timeout';

jest.mock('./fetch-with-timeout', () => {
  class TimeoutError extends Error {}
  class NetworkError extends Error {}

  return {
    DEFAULT_TIMEOUT: 30_000,
    SHORT_TIMEOUT: 10_000,
    LONG_TIMEOUT: 60_000,
    TimeoutError,
    NetworkError,
    fetchWithTimeout: jest.fn(),
  };
});

function createResponse({
  ok,
  status,
  statusText,
  body,
}: {
  ok: boolean;
  status: number;
  statusText: string;
  body?: unknown;
}): Response {
  return {
    ok,
    status,
    statusText,
    json: jest.fn().mockResolvedValue(body),
    clone: jest.fn(() => ({
      json: jest.fn().mockResolvedValue(body),
    })),
  } as unknown as Response;
}

describe('api core retry helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps API error response bodies to retryable ApiError instances', () => {
    const error = new ApiError(
      createResponse({
        ok: false,
        status: 503,
        statusText: 'Unavailable',
        body: { error: 'Service unavailable' },
      }),
      { error: 'Service unavailable' }
    );

    expect(error.message).toBe('Service unavailable');
    expect(error.isRetryable).toBe(true);
  });

  it('retries 5xx fetch responses and returns the successful response', async () => {
    const retry = jest.fn();
    const success = createResponse({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: { ok: true },
    });

    jest
      .mocked(fetchWithTimeout)
      .mockResolvedValueOnce(
        createResponse({
          ok: false,
          status: 502,
          statusText: 'Bad Gateway',
          body: { error: 'Try again' },
        })
      )
      .mockResolvedValueOnce(success);

    await expect(
      fetchWithRetry(
        '/api/products',
        {},
        { baseDelay: 0, checkNetwork: false, maxDelay: 0, onRetry: retry }
      )
    ).resolves.toBe(success);

    expect(fetchWithTimeout).toHaveBeenCalledTimes(2);
    expect(retry).toHaveBeenCalledWith(1, expect.any(ApiError), 0);
  });

  it('throws RetryExhaustedError after retryable failures are exhausted', async () => {
    jest.mocked(fetchWithTimeout).mockResolvedValue(
      createResponse({
        ok: false,
        status: 503,
        statusText: 'Unavailable',
        body: { error: 'Still unavailable' },
      })
    );

    await expect(
      fetchWithRetry(
        '/api/products',
        {},
        {
          baseDelay: 0,
          checkNetwork: false,
          maxDelay: 0,
          maxRetries: 1,
        }
      )
    ).rejects.toBeInstanceOf(RetryExhaustedError);
    expect(fetchWithTimeout).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-ok 4xx JSON responses', async () => {
    jest.mocked(fetchWithTimeout).mockResolvedValueOnce(
      createResponse({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        body: { error: 'Invalid request' },
      })
    );

    await expect(
      fetchJsonWithRetry('/api/products', {}, { checkNetwork: false })
    ).rejects.toMatchObject({
      message: 'Invalid request',
      status: 400,
    });
    expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
  });
});
