import { PostHog } from 'posthog-node';
import { sanitizePostHogProperties } from '@/lib/posthog/client-config';
import {
  DEFAULT_POSTHOG_INGEST_HOST,
  getPostHogIngestHost,
  normalizePostHogHost,
  type PostHogEnv,
} from '@/lib/posthog/config';

const SERVER_DISTINCT_ID = 'baci-web-server';
const REDACTED_VALUE = '[Filtered]';
const EXCEPTION_EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const EXCEPTION_LONG_NUMBER_PATTERN = /\b\d{7,}\b/g;
const EXCEPTION_URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi;
const EXCEPTION_SENSITIVE_KEY_PATTERN =
  'api[_-]?key|authorization|bvn|card(?:[_-]?number)?|cvv|customer[_-]?email|email|nin|otp|password|passcode|phone|pin|reference|secret|token|transaction[_-]?reference|trxref';
const EXCEPTION_SENSITIVE_ASSIGNMENT_PATTERN = new RegExp(
  `(["']?)\\b(${EXCEPTION_SENSITIVE_KEY_PATTERN})\\b\\1(\\s*[:=]\\s*)(["']?)(?:Bearer\\s+)?[^&\\s"',;)}\\]]+\\4`,
  'gi'
);

let postHogServerClient: PostHog | null = null;
let postHogServerClientKey: string | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getServerToken(env: PostHogEnv): string | undefined {
  return (
    env.POSTHOG_PROJECT_TOKEN?.trim() ||
    env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim() ||
    undefined
  );
}

function getServerHost(env: PostHogEnv): string {
  return normalizePostHogHost(env.POSTHOG_HOST) || getPostHogIngestHost(env);
}

function stripUrlQuery(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return value;
  }
}

function sanitizeExceptionText(value: string): string {
  return value
    .replace(EXCEPTION_URL_PATTERN, stripUrlQuery)
    .replace(
      EXCEPTION_SENSITIVE_ASSIGNMENT_PATTERN,
      (
        _match,
        keyQuote: string,
        key: string,
        separator: string,
        valueQuote: string
      ) =>
        `${keyQuote}${key}${keyQuote}${separator}${valueQuote}${REDACTED_VALUE}${valueQuote}`
    )
    .replace(EXCEPTION_EMAIL_PATTERN, REDACTED_VALUE)
    .replace(EXCEPTION_LONG_NUMBER_PATTERN, REDACTED_VALUE);
}

function sanitizeExceptionValue(
  value: unknown,
  seen: WeakSet<object>
): unknown {
  if (value instanceof Error) {
    return cloneSanitizedException(value, seen);
  }

  if (typeof value === 'string') {
    return sanitizeExceptionText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeExceptionValue(item, seen));
  }

  if (isRecord(value)) {
    if (seen.has(value)) {
      return '[Circular]';
    }

    seen.add(value);
    const sanitizedRecord = Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sanitizeExceptionValue(item, seen),
      ])
    );
    seen.delete(value);

    return sanitizePostHogProperties(sanitizedRecord);
  }

  return value;
}

function cloneSanitizedException(error: Error, seen: WeakSet<object>): Error {
  if (seen.has(error)) {
    return new Error('[Circular]');
  }

  seen.add(error);
  const sanitizedError = new Error(sanitizeExceptionText(error.message));
  sanitizedError.name = error.name;

  if (error.stack) {
    sanitizedError.stack = sanitizeExceptionText(error.stack);
  }

  if ('cause' in error) {
    Object.defineProperty(sanitizedError, 'cause', {
      configurable: true,
      enumerable: false,
      value: sanitizeExceptionValue(
        (error as Error & { cause?: unknown }).cause,
        seen
      ),
      writable: true,
    });
  }

  seen.delete(error);
  return sanitizedError;
}

function sanitizePostHogException(error: unknown): unknown {
  return sanitizeExceptionValue(error, new WeakSet<object>());
}

export function isPostHogServerConfigured(
  env: PostHogEnv = process.env
): boolean {
  return Boolean(getServerToken(env));
}

export function getPostHogServerClient(
  env: PostHogEnv = process.env
): PostHog | null {
  const token = getServerToken(env);

  if (!token) {
    return null;
  }

  const host = getServerHost(env) || DEFAULT_POSTHOG_INGEST_HOST;
  const clientKey = `${token}:${host}`;

  if (!postHogServerClient || postHogServerClientKey !== clientKey) {
    postHogServerClient = new PostHog(token, {
      host,
      flushAt: 1,
      flushInterval: 0,
    });
    postHogServerClientKey = clientKey;
  }

  return postHogServerClient;
}

export async function captureServerException(
  error: unknown,
  properties?: Record<string, unknown>,
  distinctId = SERVER_DISTINCT_ID
): Promise<boolean> {
  const client = getPostHogServerClient();

  if (!client) {
    return false;
  }

  try {
    await client.captureExceptionImmediate(
      sanitizePostHogException(error),
      distinctId,
      sanitizePostHogProperties({
        ...properties,
        app_surface: 'web',
        runtime: 'nodejs',
        deployment_environment:
          process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
      })
    );

    return true;
  } catch {
    return false;
  }
}
