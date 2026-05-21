import { describe, expect, it, vi } from 'vitest';
import {
  getBuilderGeminiFailure,
  isBuilderGeminiQuotaError,
  runBuilderGeminiWithTimeout,
} from '@/app/api/builder/gemini/route-provider-errors';

describe('builder Gemini provider errors', () => {
  it('classifies Gemini quota exhaustion as a controlled rate limit', () => {
    const error = new Error(
      'Quota exceeded for metric: generate_content_free_tier_requests'
    );

    const failure = getBuilderGeminiFailure(error, 'request-1');

    expect(isBuilderGeminiQuotaError(error)).toBe(true);
    expect(failure).toEqual({
      logLevel: 'warn',
      response: {
        error: 'AI editor quota is temporarily exhausted',
        code: 'ai_provider_rate_limited',
        details:
          'AI editing is rate limited right now. Please try again later.',
        requestId: 'request-1',
      },
      status: 429,
    });
  });

  it('classifies RESOURCE_EXHAUSTED provider errors as controlled rate limits', () => {
    const error = new Error('RESOURCE_EXHAUSTED: API quota limit reached');

    const failure = getBuilderGeminiFailure(error, 'request-resource');

    expect(isBuilderGeminiQuotaError(error)).toBe(true);
    expect(failure.status).toBe(429);
    expect(failure.response.code).toBe('ai_provider_rate_limited');
  });

  it('keeps unknown provider failures as temporary service failures', () => {
    const failure = getBuilderGeminiFailure(
      new Error('network unavailable'),
      'request-2'
    );

    expect(failure).toEqual({
      logLevel: 'error',
      response: {
        error: 'AI editor is temporarily unavailable',
        code: 'ai_provider_unavailable',
        requestId: 'request-2',
      },
      status: 503,
    });
  });

  it('maps abort errors to timeout failures', async () => {
    vi.useFakeTimers();
    try {
      const promise = runBuilderGeminiWithTimeout(
        (signal) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => {
              const error = new Error('aborted');
              error.name = 'AbortError';
              reject(error);
            });
          })
      );
      const assertion = expect(promise).rejects.toMatchObject({
        name: 'BuilderGeminiTimeoutError',
        message: 'builder_gemini_timeout',
      });

      await vi.advanceTimersByTimeAsync(25_000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('preserves non-abort errors that arrive after the timeout signal', async () => {
    vi.useFakeTimers();
    try {
      const providerError = new Error('late provider failure');
      const promise = runBuilderGeminiWithTimeout(
        () =>
          new Promise((_resolve, reject) => {
            setTimeout(() => reject(providerError), 25_001);
          })
      );
      const assertion = expect(promise).rejects.toBe(providerError);

      await vi.advanceTimersByTimeAsync(25_001);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
