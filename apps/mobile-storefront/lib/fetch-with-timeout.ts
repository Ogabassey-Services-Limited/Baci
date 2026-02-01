/**
 * Fetch With Timeout Utility
 *
 * 2026 Best Practices:
 * - AbortController for request cancellation and timeout
 * - Configurable timeout duration (default 30 seconds)
 * - Proper cleanup to prevent memory leaks
 * - Type-safe response handling
 */

/** Default timeout in milliseconds (30 seconds) */
export const DEFAULT_TIMEOUT = 30000;

/** Shorter timeout for non-critical requests (10 seconds) */
export const SHORT_TIMEOUT = 10000;

/** Longer timeout for uploads/heavy operations (60 seconds) */
export const LONG_TIMEOUT = 60000;

export class TimeoutError extends Error {
  constructor(timeout: number) {
    super(`Request timed out after ${timeout}ms`);
    this.name = 'TimeoutError';
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

interface FetchWithTimeoutOptions extends RequestInit {
  /** Timeout in milliseconds. Defaults to 30000 (30 seconds) */
  timeout?: number;
}

/**
 * Fetch wrapper with AbortController timeout
 *
 * @example
 * ```ts
 * // Basic usage with default 30s timeout
 * const response = await fetchWithTimeout('/api/data');
 *
 * // Custom timeout
 * const response = await fetchWithTimeout('/api/heavy', {
 *   timeout: LONG_TIMEOUT,
 *   method: 'POST',
 *   body: JSON.stringify(data),
 * });
 * ```
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });

    return response;
  } catch (error) {
    // Check if it was an abort (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError(timeout);
    }

    // Check for network errors
    if (error instanceof TypeError && error.message.includes('Network')) {
      throw new NetworkError(
        'Network request failed. Please check your connection.'
      );
    }

    throw error;
  } finally {
    // Always clear the timeout to prevent memory leaks
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch JSON with timeout
 * Convenience wrapper that parses JSON response
 *
 * @example
 * ```ts
 * const data = await fetchJsonWithTimeout<MyType>('/api/data');
 * ```
 */
export async function fetchJsonWithTimeout<T>(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<T> {
  const response = await fetchWithTimeout(url, options);

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return response.json() as Promise<T>;
}
