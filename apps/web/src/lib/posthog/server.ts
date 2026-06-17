import { PostHog } from 'posthog-node';
import { sanitizePostHogProperties } from './client-config';
import {
  DEFAULT_POSTHOG_INGEST_HOST,
  getPostHogIngestHost,
  type PostHogEnv,
} from './config';

const SERVER_DISTINCT_ID = 'baci-web-server';

let postHogServerClient: PostHog | null = null;

function getServerToken(env: PostHogEnv): string | undefined {
  return (
    env.POSTHOG_PROJECT_TOKEN?.trim() ||
    env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim() ||
    undefined
  );
}

function getServerHost(env: PostHogEnv): string {
  return env.POSTHOG_HOST?.trim() || getPostHogIngestHost(env);
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

  if (!postHogServerClient) {
    postHogServerClient = new PostHog(token, {
      host: getServerHost(env) || DEFAULT_POSTHOG_INGEST_HOST,
      flushAt: 1,
      flushInterval: 0,
    });
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

  await client.captureExceptionImmediate(
    error,
    distinctId,
    sanitizePostHogProperties({
      app_surface: 'web',
      runtime: 'nodejs',
      deployment_environment:
        process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
      ...properties,
    })
  );

  return true;
}
