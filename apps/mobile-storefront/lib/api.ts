/**
 * API Utility with Retry Logic
 *
 * 2026 Best Practices:
 * - Automatic retry with exponential backoff (3 attempts)
 * - Only retries on network errors or 5xx responses (not 4xx client errors)
 * - Configurable timeout handling via AbortController
 * - Network connectivity check before requests
 * - Typed error handling for better error recovery
 * - Works with both fetch and Supabase client operations
 */

import NetInfo from '@react-native-community/netinfo';
import {
  fetchWithTimeout,
  DEFAULT_TIMEOUT,
  SHORT_TIMEOUT,
  LONG_TIMEOUT,
  TimeoutError,
  NetworkError,
} from './fetch-with-timeout';
import { createLogger } from './logger';

const log = createLogger('API');

// Re-export timeout constants and error classes for convenience
export {
  DEFAULT_TIMEOUT,
  SHORT_TIMEOUT,
  LONG_TIMEOUT,
  TimeoutError,
  NetworkError,
};

/** Default number of retry attempts */
export const DEFAULT_MAX_RETRIES = 3;

/** Base delay for exponential backoff (milliseconds) */
export const BASE_RETRY_DELAY = 1000;

/** Maximum retry delay (milliseconds) */
export const MAX_RETRY_DELAY = 30000;

/**
 * Custom error for retry exhaustion
 */
export class RetryExhaustedError extends Error {
  attempts: number;
  lastError: Error;

  constructor(attempts: number, lastError: Error) {
    super(`Request failed after ${attempts} attempts: ${lastError.message}`);
    this.name = 'RetryExhaustedError';
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

/**
 * API error with status code and response details
 */
export class ApiError extends Error {
  status: number;
  statusText: string;
  body?: unknown;
  isRetryable: boolean;

  constructor(response: Response, body?: unknown) {
    const message =
      body && typeof body === 'object' && 'error' in body
        ? String((body as { error: unknown }).error)
        : `HTTP ${response.status}: ${response.statusText}`;
    super(message);
    this.name = 'ApiError';
    this.status = response.status;
    this.statusText = response.statusText;
    this.body = body;
    // 5xx errors are retryable, 4xx are not
    this.isRetryable = response.status >= 500;
  }
}

interface RetryOptions {
  /** Maximum number of retry attempts. Defaults to 3 */
  maxRetries?: number;
  /** Base delay for exponential backoff in ms. Defaults to 1000 */
  baseDelay?: number;
  /** Maximum delay between retries in ms. Defaults to 30000 */
  maxDelay?: number;
  /** Request timeout in ms. Defaults to 30000 */
  timeout?: number;
  /** Whether to check network connectivity before each attempt. Defaults to true */
  checkNetwork?: boolean;
  /** Custom function to determine if an error is retryable */
  isRetryable?: (error: Error) => boolean;
  /** Callback for each retry attempt (for logging/analytics) */
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

/**
 * Check if an error is retryable
 * - Network errors: YES
 * - Timeout errors: YES
 * - 5xx server errors: YES
 * - 4xx client errors: NO
 */
function defaultIsRetryable(error: Error): boolean {
  if (error instanceof NetworkError) return true;
  if (error instanceof TimeoutError) return true;
  if (error instanceof ApiError) return error.isRetryable;
  // TypeError usually indicates network issues in fetch
  if (error instanceof TypeError && error.message.includes('Network'))
    return true;
  return false;
}

/**
 * Calculate delay for exponential backoff with jitter
 * Formula: min(maxDelay, baseDelay * 2^attempt + random jitter)
 */
function calculateBackoffDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number
): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  // Add random jitter (0-25% of delay) to prevent thundering herd
  const jitter = Math.random() * exponentialDelay * 0.25;
  return Math.min(maxDelay, exponentialDelay + jitter);
}

/**
 * Check network connectivity
 */
async function checkNetworkConnectivity(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true && state.isInternetReachable !== false;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with automatic retry and exponential backoff
 *
 * @example
 * ```ts
 * // Basic usage - retries up to 3 times on 5xx or network errors
 * const response = await fetchWithRetry('/api/products');
 *
 * // Custom options
 * const response = await fetchWithRetry('/api/orders', {
 *   method: 'POST',
 *   body: JSON.stringify(data),
 *   headers: { 'Content-Type': 'application/json' },
 * }, {
 *   maxRetries: 5,
 *   timeout: 60000,
 *   onRetry: (attempt, error) => console.log(`Retry ${attempt}: ${error.message}`),
 * });
 * ```
 */
export async function fetchWithRetry(
  url: string,
  fetchOptions: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    baseDelay = BASE_RETRY_DELAY,
    maxDelay = MAX_RETRY_DELAY,
    timeout = DEFAULT_TIMEOUT,
    checkNetwork = true,
    isRetryable = defaultIsRetryable,
    onRetry,
  } = retryOptions;

  let lastError: Error = new Error('Request failed');
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      // Check network connectivity before each attempt
      if (checkNetwork) {
        const isOnline = await checkNetworkConnectivity();
        if (!isOnline) {
          throw new NetworkError(
            'No internet connection. Please check your network.'
          );
        }
      }

      // Make the request with timeout
      const response = await fetchWithTimeout(url, {
        ...fetchOptions,
        timeout,
      });

      // Check for server errors (5xx)
      if (response.status >= 500) {
        let body: unknown;
        try {
          body = await response.clone().json();
        } catch {
          // Response body might not be JSON
        }
        throw new ApiError(response, body);
      }

      // 4xx errors should not be retried - return the response
      // Let the caller handle client errors
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      if (!isRetryable(lastError) || attempt >= maxRetries) {
        break;
      }

      // Calculate backoff delay
      const delayMs = calculateBackoffDelay(attempt, baseDelay, maxDelay);

      // Notify about retry
      if (onRetry) {
        onRetry(attempt + 1, lastError, delayMs);
      }

      log.info(
        `Retry ${attempt + 1}/${maxRetries} after ${delayMs}ms: ${lastError.message}`
      );

      // Wait before retrying
      await sleep(delayMs);
      attempt++;
    }
  }

  // All retries exhausted
  throw new RetryExhaustedError(attempt, lastError);
}

/**
 * Fetch JSON with automatic retry
 * Convenience wrapper that parses JSON response
 *
 * @example
 * ```ts
 * const data = await fetchJsonWithRetry<Product[]>('/api/products');
 * ```
 */
export async function fetchJsonWithRetry<T>(
  url: string,
  fetchOptions: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<T> {
  const response = await fetchWithRetry(url, fetchOptions, retryOptions);

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      // Response might not be JSON
    }
    throw new ApiError(response, body);
  }

  return response.json() as Promise<T>;
}

/**
 * Wrapper for Supabase client operations with retry logic
 *
 * This is useful for wrapping Supabase queries that might fail due to network issues.
 * Note: Supabase client handles some retry internally, but this provides additional
 * resilience for critical operations.
 *
 * @example
 * ```ts
 * const { data, error } = await withRetry(
 *   () => supabase.from('products').select('id, name, price, slug, image').eq('status', 'active'),
 *   { maxRetries: 3 }
 * );
 * ```
 */
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
      // Check network connectivity before each attempt
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

      // Check if error indicates a server/network issue (not a data error)
      const shouldRetry =
        isRetryable(lastError) ||
        // Supabase often throws generic errors for network issues
        lastError.message.includes('network') ||
        lastError.message.includes('Network') ||
        lastError.message.includes('timeout') ||
        lastError.message.includes('Timeout') ||
        lastError.message.includes('ECONNREFUSED') ||
        lastError.message.includes('ETIMEDOUT');

      if (!shouldRetry || attempt >= maxRetries) {
        break;
      }

      // Calculate backoff delay
      const delayMs = calculateBackoffDelay(attempt, baseDelay, maxDelay);

      // Notify about retry
      if (onRetry) {
        onRetry(attempt + 1, lastError, delayMs);
      }

      log.info(
        `Retry ${attempt + 1}/${maxRetries} after ${delayMs}ms: ${lastError.message}`
      );

      // Wait before retrying
      await sleep(delayMs);
      attempt++;
    }
  }

  // All retries exhausted
  throw new RetryExhaustedError(attempt, lastError);
}

/**
 * Wrapper for Supabase query results with retry logic
 *
 * Specifically handles Supabase's { data, error } pattern and retries on
 * network/server errors while preserving the original response structure.
 *
 * @example
 * ```ts
 * const result = await withSupabaseRetry(
 *   () => supabase.from('products').select('id, name, price, slug, image').eq('status', 'active')
 * );
 *
 * if (result.error) {
 *   // Handle error (after all retries exhausted)
 * } else {
 *   // Use result.data
 * }
 * ```
 */
/**
 * Wrapper for Supabase query results with retry logic
 *
 * Specifically handles Supabase's { data, error } pattern and retries on
 * network/server errors while preserving the original response structure.
 *
 * @example
 * ```ts
 * const result = await withSupabaseRetry(
 *   () => supabase.from('products').select('id, name, price, slug, image').eq('status', 'active')
 * );
 *
 * if (result.error) {
 *   // Handle error (after all retries exhausted)
 * } else {
 *   // Use result.data
 * }
 * ```
 */
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
      // Check network connectivity before each attempt
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

      // If no error, return the result
      if (!result.error) {
        return result;
      }

      // Check if this is a retryable error (network/server issues)
      const errorMessage = result.error.message.toLowerCase();
      const isRetryableError =
        errorMessage.includes('network') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('econnrefused') ||
        errorMessage.includes('etimedout') ||
        errorMessage.includes('fetch failed') ||
        errorMessage.includes('connection');

      // Don't retry on data validation errors, standard auth errors, or not found
      // Note: "Network request failed" is caught by isRetryableError check
      const isClientError =
        errorMessage.includes('not found') ||
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('forbidden') ||
        errorMessage.includes('invalid') ||
        errorMessage.includes('duplicate');

      if (isClientError || !isRetryableError || attempt >= maxRetries) {
        return result;
      }

      // Calculate backoff delay
      const delayMs = calculateBackoffDelay(attempt, baseDelay, maxDelay);

      // Notify about retry
      if (onRetry) {
        // onRetry expects an Error, so we construct one if it's a plain object
        const retryError = result.error instanceof Error
          ? result.error
          : new Error(result.error.message);
        onRetry(attempt + 1, retryError, delayMs);
      }

      log.info(
        `Supabase retry ${attempt + 1}/${maxRetries} after ${delayMs}ms: ${result.error.message}`
      );

      // Wait before retrying
      await sleep(delayMs);
      attempt++;
    } catch (error) {
      // Handle thrown errors (e.g., network check failure)
      const err = error instanceof Error ? error : new Error(String(error));

      if (attempt >= maxRetries) {
        // We need to return a result that matches the shape of R
        // Since we can't easily construct a generic R, we use the last result if available
        // or re-throw if it's a critical execution error (like network check failure)
        if (lastResult) return lastResult;
        throw err;
      }

      const delayMs = calculateBackoffDelay(attempt, baseDelay, maxDelay);

      if (onRetry) {
        onRetry(attempt + 1, err, delayMs);
      }

      log.info(
        `Supabase retry ${attempt + 1}/${maxRetries} after ${delayMs}ms: ${err.message}`
      );

      await sleep(delayMs);
      attempt++;
    }
  }

  return lastResult!;
}
