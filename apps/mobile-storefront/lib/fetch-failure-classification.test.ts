import { describe, expect, it } from '@jest/globals';
import { classifyFetchFailure } from './fetch-failure-classification';
import { HttpError, NetworkError, TimeoutError } from './fetch-with-timeout';

describe('classifyFetchFailure', () => {
  describe('cancellation (not reportable)', () => {
    it('classifies the production iOS cancel message as cancelled', () => {
      // Exact shape captured in PostHog: checkout_savings_goals_fetch (iOS 2.1.465)
      const result = classifyFetchFailure(
        new Error('fetch failed: Fetch request has been canceled')
      );

      expect(result.category).toBe('cancelled');
      expect(result.isReportable).toBe(false);
      expect(result.isRetryable).toBe(false);
    });

    it('classifies AbortError as cancelled regardless of message', () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      const result = classifyFetchFailure(abortError);

      expect(result.category).toBe('cancelled');
      expect(result.isReportable).toBe(false);
    });

    it('classifies okhttp "Canceled" as cancelled', () => {
      const result = classifyFetchFailure(new Error('Canceled'));

      expect(result.category).toBe('cancelled');
      expect(result.isReportable).toBe(false);
    });

    it('reclassifies an abort the caller did not request as retryable network', () => {
      const result = classifyFetchFailure(
        new Error('Fetch request has been canceled'),
        { callerAborted: false }
      );

      expect(result.category).toBe('network');
      expect(result.isRetryable).toBe(true);
      expect(result.isReportable).toBe(true);
    });

    it('keeps caller-requested aborts as cancelled when callerAborted is true', () => {
      const result = classifyFetchFailure(
        new Error('Fetch request has been canceled'),
        { callerAborted: true }
      );

      expect(result.category).toBe('cancelled');
      expect(result.isReportable).toBe(false);
    });
  });

  describe('timeouts', () => {
    it('classifies TimeoutError as retryable timeout', () => {
      const result = classifyFetchFailure(new TimeoutError(30_000));

      expect(result.category).toBe('timeout');
      expect(result.isRetryable).toBe(true);
      expect(result.isReportable).toBe(true);
    });

    it('classifies a Postgres statement timeout as timeout, not cancellation', () => {
      const result = classifyFetchFailure({
        message: 'canceling statement due to statement timeout',
        code: '57014',
      });

      expect(result.category).toBe('timeout');
      expect(result.isReportable).toBe(true);
    });
  });

  describe('dns', () => {
    it('classifies the production Android DNS failure as retryable dns', () => {
      // Exact shape captured in PostHog: checkout_savings_goals_fetch (Android 2.0.0)
      const result = classifyFetchFailure(
        new Error(
          'fetch failed: java.net.UnknownHostException: Unable to resolve host "usebaci.com": No address associated with hostname'
        )
      );

      expect(result.category).toBe('dns');
      expect(result.isRetryable).toBe(true);
      expect(result.isReportable).toBe(true);
    });

    it('classifies ENOTFOUND as dns', () => {
      const result = classifyFetchFailure(
        new Error('getaddrinfo ENOTFOUND usebaci.com')
      );

      expect(result.category).toBe('dns');
    });
  });

  describe('network', () => {
    it('classifies NetworkError instances as retryable network failures', () => {
      const result = classifyFetchFailure(
        new NetworkError(
          'Network request failed. Please check your connection.'
        )
      );

      expect(result.category).toBe('network');
      expect(result.isRetryable).toBe(true);
    });

    it('classifies a postgrest-js wrapped fetch failure (plain object) as network', () => {
      // postgrest-js wraps fetch rejections in a plain object, not an Error
      const result = classifyFetchFailure({
        message: 'TypeError: Network request failed',
        details: '',
        hint: '',
        code: '',
      });

      expect(result.category).toBe('network');
      expect(result.isRetryable).toBe(true);
    });
  });

  describe('auth', () => {
    it('classifies HttpError 401 as auth', () => {
      const result = classifyFetchFailure(new HttpError(401, 'Unauthorized'));

      expect(result.category).toBe('auth');
      expect(result.isRetryable).toBe(false);
    });

    it('classifies the api client session error as auth', () => {
      const result = classifyFetchFailure(
        new Error('Authentication required. Please sign in again.')
      );

      expect(result.category).toBe('auth');
    });

    it('classifies PostgrestError PGRST301 (JWT) as auth', () => {
      const result = classifyFetchFailure({
        message: 'JWT expired',
        code: 'PGRST301',
      });

      expect(result.category).toBe('auth');
    });
  });

  describe('http status', () => {
    it('classifies HttpError 500 as retryable http_server', () => {
      const result = classifyFetchFailure(
        new HttpError(500, 'Internal Server Error')
      );

      expect(result.category).toBe('http_server');
      expect(result.isRetryable).toBe(true);
    });

    it('classifies HttpError 422 as non-retryable http_client', () => {
      const result = classifyFetchFailure(new HttpError(422, 'Bad input'));

      expect(result.category).toBe('http_client');
      expect(result.isRetryable).toBe(false);
    });

    it('classifies HttpError 429 as retryable http_client', () => {
      const result = classifyFetchFailure(new HttpError(429, 'Rate limited'));

      expect(result.category).toBe('http_client');
      expect(result.isRetryable).toBe(true);
    });

    it('recovers the status from fetchJsonWithTimeout-style messages', () => {
      const result = classifyFetchFailure(new Error('HTTP 503: upstream down'));

      expect(result.category).toBe('http_server');
      expect(result.isRetryable).toBe(true);
    });
  });

  describe('parse', () => {
    it('classifies ZodError as non-retryable parse failure', () => {
      const zodLike = new Error('Invalid input');
      zodLike.name = 'ZodError';

      const result = classifyFetchFailure(zodLike);

      expect(result.category).toBe('parse');
      expect(result.isRetryable).toBe(false);
    });

    it('classifies the non-JSON server response message as parse', () => {
      const result = classifyFetchFailure(
        new Error(
          'Invalid server response (200 OK): Unexpected token < in JSON'
        )
      );

      expect(result.category).toBe('parse');
    });
  });

  describe('unknown and sanitization', () => {
    it('falls back to unknown for unrecognized errors', () => {
      const result = classifyFetchFailure(new Error('something odd'));

      expect(result.category).toBe('unknown');
      expect(result.isRetryable).toBe(false);
      expect(result.isReportable).toBe(true);
    });

    it('stringifies non-object throwables', () => {
      const result = classifyFetchFailure('plain failure string');

      expect(result.message).toBe('plain failure string');
    });

    it('bounds the telemetry message length', () => {
      const result = classifyFetchFailure(new Error('y'.repeat(2000)));

      expect(result.message.length).toBeLessThanOrEqual(300);
    });
  });
});
