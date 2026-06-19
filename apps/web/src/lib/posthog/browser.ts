import posthog from 'posthog-js';
import { buildPostHogClientConfig } from '@/lib/posthog/client-config';
import type { PostHogEnv } from '@/lib/posthog/config';

const MISSING_TOKEN_WARNING =
  '[PostHog] NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is missing; web analytics and error capture are disabled.';
const POSTHOG_NODE_ENV = process.env.NODE_ENV;

let hasInitializedPostHogBrowser = false;
let isPostHogReadyForCapture = false;
let lastCapturedPostHogPageviewUrl: string | undefined;
const pendingPostHogPageviewUrls: string[] = [];

function isPostHogDevelopmentMode(env: PostHogEnv): boolean {
  return (env.NODE_ENV ?? POSTHOG_NODE_ENV) === 'development';
}

export function initializePostHogBrowser(
  env: PostHogEnv = process.env,
  logger: Pick<Console, 'warn'> = console
) {
  if (hasInitializedPostHogBrowser) {
    return;
  }

  const projectToken = env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();

  if (!projectToken) {
    if (isPostHogDevelopmentMode(env)) {
      logger.warn(MISSING_TOKEN_WARNING);
    }
    return;
  }

  const clientConfig = buildPostHogClientConfig(env);
  const clientLoaded = clientConfig.loaded;

  try {
    posthog.init(projectToken, {
      ...clientConfig,
      loaded(posthogInstance) {
        isPostHogReadyForCapture = true;

        try {
          clientLoaded?.(posthogInstance);
        } catch (error) {
          if (isPostHogDevelopmentMode(env)) {
            logger.warn('[PostHog] client loaded callback failed.', error);
          }
        }

        flushPendingPostHogPageviews();
      },
    });
    hasInitializedPostHogBrowser = true;
  } catch (error) {
    isPostHogReadyForCapture = false;
    throw error;
  }
}

function resolvePostHogPageviewUrl(currentUrl?: string) {
  const resolvedUrl =
    currentUrl ||
    (typeof globalThis.location === 'undefined'
      ? undefined
      : globalThis.location.href);

  return resolvedUrl;
}

function queuePostHogPageview(resolvedUrl: string) {
  if (
    pendingPostHogPageviewUrls[pendingPostHogPageviewUrls.length - 1] !==
    resolvedUrl
  ) {
    pendingPostHogPageviewUrls.push(resolvedUrl);
  }
}

function flushPendingPostHogPageviews() {
  const pendingUrls = pendingPostHogPageviewUrls.splice(0);

  for (const pendingUrl of pendingUrls) {
    sendPostHogPageview(pendingUrl);
  }
}

function sendPostHogPageview(resolvedUrl: string) {
  if (lastCapturedPostHogPageviewUrl === resolvedUrl) {
    return;
  }

  lastCapturedPostHogPageviewUrl = resolvedUrl;
  posthog.capture('$pageview', {
    $current_url: resolvedUrl,
    app_surface: 'web',
  });
}

export function capturePostHogPageview(currentUrl?: string) {
  const resolvedUrl = resolvePostHogPageviewUrl(currentUrl);

  if (!resolvedUrl) {
    return;
  }

  if (!hasInitializedPostHogBrowser || !isPostHogReadyForCapture) {
    queuePostHogPageview(resolvedUrl);
    return;
  }

  sendPostHogPageview(resolvedUrl);
}
