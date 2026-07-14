import { PostHog } from 'posthog-node';
import { getNextErrorDigest } from '@/lib/errors/next-error-digest';
import { sanitizePostHogProperties } from '@/lib/posthog/client-config';
import {
  DEFAULT_POSTHOG_INGEST_HOST,
  getPostHogIngestHost,
  getPostHogReleaseContext,
  normalizePostHogHost,
  type PostHogEnv,
} from '@/lib/posthog/config';
import { sanitizePostHogException } from '@/lib/posthog/exception-sanitizer';

const SERVER_DISTINCT_ID = 'baci-web-server';

let postHogServerClient: PostHog | null = null;
let postHogServerClientKey: string | null = null;

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

function getContextString(
  properties: Record<string, unknown> | undefined,
  key: string
): string | undefined {
  const value = properties?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeCapturedError(
  error: unknown,
  properties?: Record<string, unknown>
): unknown {
  if (!(error instanceof Error) || error.message.trim()) {
    return error;
  }

  const digest =
    getContextString(properties, 'next_error_digest') ??
    getNextErrorDigest(error);
  const requestPath = getContextString(properties, 'request_path');
  const routePath = getContextString(properties, 'route_path');
  const context = requestPath ?? routePath;
  const messageParts = [
    'Next.js request error',
    digest ? `digest ${digest}` : null,
    context ? `at ${context}` : null,
  ].filter(Boolean);
  const normalizedError = new Error(messageParts.join(' '), { cause: error });
  normalizedError.name = error.name || 'Error';
  normalizedError.stack = error.stack;

  return normalizedError;
}

/**
 * Fire-and-forget server-side product-event capture. Unlike
 * `captureServerException` (exception-only) this sends a named event with a
 * customer-keyed `distinctId`. It stamps `app_surface: 'web'`/`runtime: 'nodejs'`
 * and scrubs properties, then awaits an immediate flush so the event survives a
 * short-lived serverless invocation. The await is bounded by an internal
 * timeout and it is fail-open — it never throws — so it can be awaited safely
 * inside a payment/webhook path without delaying callers indefinitely.
 *
 * `uuid` and `timestamp` are the two halves of PostHog's ingestion dedupe key:
 * it drops a duplicate only when uuid + event name + distinct id + timestamp
 * all match. Callers that can race (e.g. a webhook and a confirm route emitting
 * the same logical event) must therefore supply BOTH a deterministic uuid and a
 * stable timestamp derived from shared persisted state — a uuid alone still
 * lets the SDK stamp a fresh per-call timestamp and both events survive.
 */
const SERVER_EVENT_CAPTURE_TIMEOUT_MS = 3_000;

export async function captureServerEvent(
  event: string,
  properties: Record<string, unknown>,
  distinctId: string = SERVER_DISTINCT_ID,
  uuid?: string,
  timestamp?: Date
): Promise<boolean> {
  const client = getPostHogServerClient();

  if (!client) {
    return false;
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      client.captureImmediate({
        distinctId,
        event,
        properties: sanitizePostHogProperties({
          ...properties,
          app_surface: 'web',
          runtime: 'nodejs',
        }),
        ...(uuid ? { uuid } : {}),
        ...(timestamp ? { timestamp } : {}),
      }),
      new Promise((_resolve, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error('captureServerEvent timed out')),
          SERVER_EVENT_CAPTURE_TIMEOUT_MS
        );
      }),
    ]);

    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutHandle);
  }
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
      sanitizePostHogException(normalizeCapturedError(error, properties)),
      distinctId,
      sanitizePostHogProperties({
        ...properties,
        app_surface: 'web',
        runtime: 'nodejs',
        deployment_environment:
          process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
        ...getPostHogReleaseContext(process.env),
      })
    );

    return true;
  } catch {
    return false;
  }
}
