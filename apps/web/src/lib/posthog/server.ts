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
