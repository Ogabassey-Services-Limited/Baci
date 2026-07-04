export class NetworkError extends Error {
  public readonly isTimeout: boolean;
  public readonly isOffline: boolean;
  public readonly statusCode?: number;
  public readonly data?: unknown;

  constructor(
    message: string,
    options: {
      isTimeout?: boolean;
      isOffline?: boolean;
      statusCode?: number;
      data?: unknown;
    } = {}
  ) {
    super(message);
    this.name = 'NetworkError';
    this.isTimeout = options.isTimeout ?? false;
    this.isOffline = options.isOffline ?? false;
    this.statusCode = options.statusCode;
    this.data = options.data;
  }
}

const CONNECTIVITY_ERROR_PATTERN =
  /network request failed|fetch failed|connectexception|failed to connect|unable to resolve host|connection (?:reset|refused|abort(?:ed)?)|software caused connection abort|network is unreachable|econnrefused|econnreset|enotfound|etimedout/i;

/**
 * React Native surfaces connection failures inconsistently across platforms:
 * iOS typically throws `TypeError: Network request failed`, while Android can
 * throw a bare Error whose message is a raw Java exception, e.g.
 * "fetch failed: java.net.ConnectException: Failed to connect to host/ip:443".
 * Detect both (including the nested `cause`) so callers surface a friendly
 * offline message instead of leaking a raw exception string to the UI — which
 * reads as "broken" to a Play reviewer.
 */
export function isConnectivityError(error: unknown): boolean {
  if (error instanceof NetworkError) {
    return false;
  }
  if (
    error instanceof TypeError &&
    error.message === 'Network request failed'
  ) {
    return true;
  }
  if (!(error instanceof Error)) {
    return false;
  }
  const cause =
    error.cause instanceof Error
      ? error.cause.message
      : typeof error.cause === 'string'
        ? error.cause
        : '';
  return CONNECTIVITY_ERROR_PATTERN.test(`${error.message} ${cause}`);
}

export function getResponseErrorMessage(data: unknown, status: number): string {
  if (typeof data === 'string' && data) {
    return data;
  }

  if (data && typeof data === 'object') {
    if ('message' in data && typeof data.message === 'string') {
      return data.message;
    }

    if ('error' in data && typeof data.error === 'string') {
      return data.error;
    }
  }

  return `Request failed with status ${status}`;
}
