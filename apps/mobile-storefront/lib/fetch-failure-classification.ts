/**
 * Transport-failure classification for storefront data fetches.
 *
 * Production error events were unactionable because an intentional
 * unmount abort ("Fetch request has been canceled"), a device DNS outage
 * (java.net.UnknownHostException) and a real API failure all surfaced as
 * the same generic message. Every fetch surface reports through this
 * classifier so telemetry carries a stable category, cancellation is not
 * treated as an error, and callers know whether a retry is worthwhile.
 *
 * Handles Error instances (TimeoutError / NetworkError / HttpError from
 * fetch-with-timeout, AbortError, ZodError) as well as plain error objects
 * such as Supabase PostgrestError ({ message, code }) and postgrest-js
 * network-failure wrappers.
 */

export type FetchFailureCategory =
  | 'cancelled'
  | 'timeout'
  | 'dns'
  | 'network'
  | 'auth'
  | 'http_client'
  | 'http_server'
  | 'parse'
  | 'unknown';

export interface ClassifiedFetchFailure {
  category: FetchFailureCategory;
  /** Transient failure — an idempotent request may be retried. */
  isRetryable: boolean;
  /** False only for intentional cancellation (unmount/navigation aborts). */
  isReportable: boolean;
  /** Length-bounded message safe for telemetry (no request bodies/tokens). */
  message: string;
}

const MAX_MESSAGE_LENGTH = 300;

const DNS_PATTERN =
  /unknownhostexception|no address associated|enotfound|eai_again|unable to resolve host/i;
// "aborted"/"cancel(l)ed" only: Android's "Software caused connection
// abort" is a genuine network failure and must fall through to `network`.
const CANCEL_PATTERN = /\baborted\b|\bcancell?ed\b/i;
const TIMEOUT_PATTERN = /timed? ?out|etimedout/i;
// Postgres cancels statements on timeout — must be checked before the
// cancel pattern or a server-side timeout would be dropped as intentional.
const STATEMENT_TIMEOUT_PATTERN = /canceling statement/i;
const AUTH_MESSAGE_PATTERN =
  /authentication required|unauthorized|forbidden|jwt expired|invalid (?:token|jwt)|session expired|refresh token/i;
const NETWORK_PATTERN =
  /network request failed|fetch failed|failed to fetch|socketexception|econnrefused|econnreset|econnaborted|connection (?:refused|reset|abort|closed)|internet connection|\boffline\b|network error/i;
const PARSE_PATTERN =
  /invalid server response|non-json response|unexpected token|json parse/i;

interface ExtractedError {
  name: string;
  message: string;
  code: string;
  status: number | null;
}

function extract(error: unknown): ExtractedError {
  if (error instanceof Error) {
    const withMeta = error as Error & { code?: unknown; status?: unknown };
    return {
      name: error.name,
      message: error.message,
      code: typeof withMeta.code === 'string' ? withMeta.code : '',
      status: typeof withMeta.status === 'number' ? withMeta.status : null,
    };
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    return {
      name: typeof record.name === 'string' ? record.name : '',
      message: typeof record.message === 'string' ? record.message : '',
      code: typeof record.code === 'string' ? record.code : '',
      status: typeof record.status === 'number' ? record.status : null,
    };
  }

  return {
    name: '',
    message: typeof error === 'string' ? error : String(error),
    code: '',
    status: null,
  };
}

function extractStatusFromMessage(message: string): number | null {
  const match =
    /^http (\d{3})/i.exec(message) ??
    /invalid server response \((\d{3})/i.exec(message);
  return match ? Number(match[1]) : null;
}

function classifyHttpStatus(
  status: number
): ClassifiedFetchFailure['category'] {
  if (status === 401 || status === 403) return 'auth';
  if (status >= 500) return 'http_server';
  return 'http_client';
}

export function classifyFetchFailure(error: unknown): ClassifiedFetchFailure {
  const { name, message, code } = extract(error);
  const status = extract(error).status ?? extractStatusFromMessage(message);
  const text = `${name} ${message}`;

  const result = (
    category: FetchFailureCategory,
    isRetryable: boolean,
    isReportable = true
  ): ClassifiedFetchFailure => ({
    category,
    isRetryable,
    isReportable,
    message: (message || name || 'Unknown fetch failure').slice(
      0,
      MAX_MESSAGE_LENGTH
    ),
  });

  // Postgres statement timeout masquerades as a cancellation.
  if (code === '57014' || STATEMENT_TIMEOUT_PATTERN.test(text)) {
    return result('timeout', true);
  }

  if (name === 'TimeoutError' || TIMEOUT_PATTERN.test(text)) {
    return result('timeout', true);
  }

  // Intentional aborts: unmount/navigation cleanup, superseded requests.
  // iOS RN: "Fetch request has been canceled"; okhttp: "Canceled";
  // undici/DOM: AbortError "The operation was aborted".
  if (name === 'AbortError' || CANCEL_PATTERN.test(text)) {
    return result('cancelled', false, false);
  }

  if (status !== null && status >= 400) {
    const category = classifyHttpStatus(status);
    const isRetryable =
      category === 'http_server' || status === 408 || status === 429;
    return result(category, isRetryable);
  }

  if (
    code === 'PGRST301' ||
    code === 'PGRST302' ||
    name === 'AuthApiError' ||
    name === 'AuthSessionMissingError' ||
    AUTH_MESSAGE_PATTERN.test(text)
  ) {
    return result('auth', false);
  }

  if (DNS_PATTERN.test(text)) {
    return result('dns', true);
  }

  if (name === 'NetworkError' || NETWORK_PATTERN.test(text)) {
    return result('network', true);
  }

  if (
    name === 'ZodError' ||
    name === 'SyntaxError' ||
    PARSE_PATTERN.test(text)
  ) {
    return result('parse', false);
  }

  return result('unknown', false);
}
