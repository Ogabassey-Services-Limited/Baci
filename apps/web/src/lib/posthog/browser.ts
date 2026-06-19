import posthog from 'posthog-js';
import { buildPostHogClientConfig } from '@/lib/posthog/client-config';
import type { PostHogEnv } from '@/lib/posthog/config';

const MISSING_TOKEN_WARNING =
  '[PostHog] NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is missing; web analytics and error capture are disabled.';
const POSTHOG_NODE_ENV = process.env.NODE_ENV;
const POSTHOG_PAGEVIEW_CAPTURE_OPTIONS = { send_instantly: true } as const;

let hasInitializedPostHogBrowser = false;
let isPostHogReadyForCapture = false;
let isPostHogBrowserDisabled = false;
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
    isPostHogBrowserDisabled = true;
    pendingPostHogPageviewUrls.length = 0;

    if (isPostHogDevelopmentMode(env)) {
      logger.warn(MISSING_TOKEN_WARNING);
    }
    return;
  }

  isPostHogBrowserDisabled = false;

  const clientConfig = buildPostHogClientConfig(env);
  const clientLoaded = clientConfig.loaded;

  try {
    posthog.init(projectToken, {
      ...clientConfig,
      loaded(posthogInstance) {
        try {
          clientLoaded?.(posthogInstance);
        } catch (error) {
          if (isPostHogDevelopmentMode(env)) {
            logger.warn('[PostHog] client loaded callback failed.', error);
          }
        }

        markPostHogReadyAndFlush();
      },
    });
    hasInitializedPostHogBrowser = true;
    flushPendingPostHogPageviewsIfClientLoaded();
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

  flushPendingPostHogPageviewsIfClientLoaded();
}

function isPostHogClientLoaded() {
  // The public PostHog path is the `loaded` callback above. `posthog-js@1.387.0`
  // also exposes `__loaded` in its bundled TypeScript definitions; use it only as
  // a fallback for missed callback races, and re-check this line during SDK bumps.
  return posthog.__loaded === true;
}

function markPostHogReadyAndFlush() {
  if (isPostHogReadyForCapture) {
    return;
  }

  isPostHogReadyForCapture = true;
  flushPendingPostHogPageviews();
}

function flushPendingPostHogPageviewsIfClientLoaded() {
  if (isPostHogReadyForCapture || !isPostHogClientLoaded()) {
    return;
  }

  markPostHogReadyAndFlush();
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
  posthog.capture(
    '$pageview',
    {
      $current_url: resolvedUrl,
      app_surface: 'web',
    },
    POSTHOG_PAGEVIEW_CAPTURE_OPTIONS
  );
}

export function capturePostHogPageview(currentUrl?: string) {
  if (isPostHogBrowserDisabled) {
    return;
  }

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
