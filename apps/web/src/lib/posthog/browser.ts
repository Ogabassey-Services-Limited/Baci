import posthog from 'posthog-js';
import { buildPostHogClientConfig } from '@/lib/posthog/client-config';
import type { PostHogEnv } from '@/lib/posthog/config';

const MISSING_TOKEN_WARNING =
  '[PostHog] NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is missing; web analytics and error capture are disabled.';

let hasInitializedPostHogBrowser = false;
let isPostHogReadyForCapture = false;
let lastCapturedPostHogPageviewUrl: string | undefined;
let pendingPostHogPageviewUrl: string | undefined;

export function initializePostHogBrowser(
  env: PostHogEnv = process.env,
  logger: Pick<Console, 'warn'> = console
) {
  if (hasInitializedPostHogBrowser) {
    return;
  }

  const projectToken = env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();

  if (!projectToken) {
    if (env.NODE_ENV === 'development') {
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
          if (env.NODE_ENV === 'development') {
            logger.warn('[PostHog] client loaded callback failed.', error);
          }
        }

        const pendingUrl = pendingPostHogPageviewUrl;
        pendingPostHogPageviewUrl = undefined;

        if (pendingUrl) {
          sendPostHogPageview(pendingUrl);
        }
      },
    });
    hasInitializedPostHogBrowser = true;
  } catch (error) {
    isPostHogReadyForCapture = false;
    pendingPostHogPageviewUrl = undefined;
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
  if (!hasInitializedPostHogBrowser) {
    return;
  }

  const resolvedUrl = resolvePostHogPageviewUrl(currentUrl);

  if (!resolvedUrl) {
    return;
  }

  if (!isPostHogReadyForCapture) {
    pendingPostHogPageviewUrl = resolvedUrl;
    return;
  }

  sendPostHogPageview(resolvedUrl);
}
