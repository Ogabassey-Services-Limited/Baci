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

/**
 * Thrown for non-2xx HTTP responses. Preserves `status` so callers can
 * distinguish definitive client failures (4xx — request rejected, no
 * server state) from ambiguous server failures (5xx — partial state may
 * have been persisted). Idempotency-key callers MUST keep their key on
 * 5xx so a retry hits the route's dedupe table; only 4xx is safe to
 * rotate on.
 */
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
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
  const {
    timeout = DEFAULT_TIMEOUT,
    signal: callerSignal,
    ...fetchOptions
  } = options;

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // H22 fix: Compose caller signal with internal timeout signal.
  // AbortSignal.any() is NOT available in Hermes (React Native), so we
  // manually link signals via a combined AbortController.
  let combinedSignal: AbortSignal;
  if (callerSignal) {
    const combined = new AbortController();
    for (const sig of [callerSignal, controller.signal]) {
      if (sig.aborted) {
        combined.abort(sig.reason);
        break;
      }
      sig.addEventListener('abort', () => combined.abort(sig.reason), {
        once: true,
      });
    }
    combinedSignal = combined.signal;
  } else {
    combinedSignal = controller.signal;
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: combinedSignal,
    });

    return response;
  } catch (error) {
    // Check if it was an abort (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      // TODO: Implement retry UI at component level
      throw new TimeoutError(timeout);
    }

    // Check for network errors
    if (error instanceof TypeError && error.message.includes('Network')) {
      // TODO: Implement offline data cache with cache-first strategy
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

  try {
    return await (response.json() as Promise<T>);
  } catch {
    throw new Error(
      `Server returned non-JSON response (HTTP ${response.status}). ` +
        'The server may have returned an HTML error page.'
    );
  }
}
