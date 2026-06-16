import {
  BASE_RETRY_DELAY,
  calculateBackoffDelay,
  checkNetworkConnectivity,
  DEFAULT_MAX_RETRIES,
  defaultIsRetryable,
  MAX_RETRY_DELAY,
  NetworkError,
  RetryExhaustedError,
  type RetryOptions,
  sleep,
} from './api-core';
import { createLogger } from './logger';

const log = createLogger('API');

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Omit<RetryOptions, 'timeout'> = {}
): Promise<T> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    baseDelay = BASE_RETRY_DELAY,
    maxDelay = MAX_RETRY_DELAY,
    checkNetwork = true,
    isRetryable = defaultIsRetryable,
    onRetry,
  } = options;

  let lastError: Error = new Error('Operation failed');
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      if (checkNetwork) {
        const isOnline = await checkNetworkConnectivity();
        if (!isOnline) {
          throw new NetworkError(
            'No internet connection. Please check your network.'
          );
        }
      }

      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const shouldRetry =
        isRetryable(lastError) ||
        lastError.message.toLowerCase().includes('econnrefused') ||
        lastError.message.toLowerCase().includes('etimedout');

      if (!shouldRetry || attempt >= maxRetries) {
        break;
      }

      const delayMs = calculateBackoffDelay(attempt, baseDelay, maxDelay);
      onRetry?.(attempt + 1, lastError, delayMs);
      log.info(
        `Retry ${attempt + 1}/${maxRetries} after ${delayMs}ms: ${lastError.message}`
      );

      await sleep(delayMs);
      attempt++;
    }
  }

  throw new RetryExhaustedError(attempt, lastError);
}

export async function withSupabaseRetry<
  R extends { data: unknown; error: { message: string } | null },
>(
  operation: () => Promise<R>,
  options: Omit<RetryOptions, 'timeout'> = {}
): Promise<R> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    baseDelay = BASE_RETRY_DELAY,
    maxDelay = MAX_RETRY_DELAY,
    checkNetwork = true,
    onRetry,
  } = options;

  let lastResult: R | null = null;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      if (checkNetwork) {
        const isOnline = await checkNetworkConnectivity();
        if (!isOnline) {
          throw new NetworkError(
            'No internet connection. Please check your network.'
          );
        }
      }

      const result = await operation();
      lastResult = result;

      if (!result.error) {
        return result;
      }

      const errorMessage = result.error.message.toLowerCase();
      const isRetryableError =
        errorMessage.includes('network') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('econnrefused') ||
        errorMessage.includes('etimedout') ||
        errorMessage.includes('fetch failed') ||
        errorMessage.includes('connection');
      const isClientError =
        errorMessage.includes('not found') ||
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('forbidden') ||
        errorMessage.includes('invalid') ||
        errorMessage.includes('duplicate');

      if (isClientError || !isRetryableError || attempt >= maxRetries) {
        return result;
      }

      const delayMs = calculateBackoffDelay(attempt, baseDelay, maxDelay);
      if (onRetry) {
        const retryError =
          result.error instanceof Error
            ? result.error
            : new Error(result.error.message);
        onRetry(attempt + 1, retryError, delayMs);
      }

      log.info(
        `Supabase retry ${attempt + 1}/${maxRetries} after ${delayMs}ms: ${result.error.message}`
      );

      await sleep(delayMs);
      attempt++;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (attempt >= maxRetries) {
        if (lastResult) return lastResult;
        throw err;
      }

      const delayMs = calculateBackoffDelay(attempt, baseDelay, maxDelay);
      onRetry?.(attempt + 1, err, delayMs);
      log.info(
        `Supabase retry ${attempt + 1}/${maxRetries} after ${delayMs}ms: ${err.message}`
      );

      await sleep(delayMs);
      attempt++;
    }
  }

  if (!lastResult) {
    throw new Error(
      'api-supabase-retry: retry loop failed to produce a result'
    );
  }

  return lastResult;
}
