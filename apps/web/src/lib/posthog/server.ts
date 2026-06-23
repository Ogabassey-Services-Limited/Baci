import { PostHog } from 'posthog-node';
import { sanitizePostHogProperties } from '@/lib/posthog/client-config';
import {
  DEFAULT_POSTHOG_INGEST_HOST,
  getPostHogIngestHost,
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

function getErrorDigest(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('digest' in error)) {
    return undefined;
  }

  const digest = (error as { digest?: unknown }).digest;
  if (typeof digest !== 'string') {
    return undefined;
  }

  const trimmedDigest = digest.trim();
  return trimmedDigest || undefined;
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
    getContextString(properties, 'next_error_digest') ?? getErrorDigest(error);
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
      })
    );

    return true;
  } catch {
    return false;
  }
}
