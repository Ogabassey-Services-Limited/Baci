import posthog from 'posthog-js';
import { buildPostHogClientConfig } from '@/lib/posthog/client-config';
import type { PostHogEnv } from '@/lib/posthog/config';
import { isPublicBlogPathname } from '@/lib/posthog/public-blog-path';

const MISSING_TOKEN_WARNING =
  '[PostHog] NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is missing; web analytics and error capture are disabled.';
const POSTHOG_NODE_ENV = process.env.NODE_ENV;
const POSTHOG_PAGEVIEW_CAPTURE_OPTIONS = { send_instantly: true } as const;
const POSTHOG_LOADED_STATE_CHECK_INTERVAL_MS = 250;
const POSTHOG_LOADED_STATE_CHECK_ATTEMPTS = 40;

let hasInitializedPostHogBrowser = false;
let lastConfiguredPostHogLightweight: boolean | undefined;
let isPostHogReadyForCapture = false;
let isPostHogBrowserDisabled = false;
let lastCapturedPostHogPageviewUrl: string | undefined;
let postHogLoadedStateCheckAttempts = 0;
let postHogLoadedStateCheckTimer:
  | ReturnType<typeof globalThis.setTimeout>
  | undefined;
const pendingPostHogPageviewUrls: string[] = [];

function isPostHogDevelopmentMode(env: PostHogEnv): boolean {
  return (env.NODE_ENV ?? POSTHOG_NODE_ENV) === 'development';
}

export interface InitializePostHogBrowserOptions {
  lightweight?: boolean;
  pathname?: string;
  hostname?: string;
}

function isLightweightPostHogSurface(
  options: InitializePostHogBrowserOptions = {}
): boolean {
  if (options.lightweight !== undefined) {
    return options.lightweight;
  }

  const pathname =
    options.pathname ||
    (typeof globalThis.location === 'undefined'
      ? undefined
      : globalThis.location.pathname);

  if (!pathname) {
    return false;
  }

  return isPublicBlogPathname(pathname, {
    hostname:
      options.hostname ||
      (typeof globalThis.location === 'undefined'
        ? undefined
        : globalThis.location.hostname),
  });
}

type PostHogBrowserClientConfig = ReturnType<typeof buildPostHogClientConfig>;

function splitPostHogInitConfig(clientConfig: PostHogBrowserClientConfig) {
  const { advanced_disable_flags: advancedDisableFlags, ...initConfig } =
    clientConfig;

  return { advancedDisableFlags, initConfig };
}

function applyPostHogFlagDisableConfig(
  advancedDisableFlags: PostHogBrowserClientConfig['advanced_disable_flags']
) {
  if (advancedDisableFlags === true) {
    posthog.set_config({ advanced_disable_flags: true });
  }
}

function maybeReloadPostHogFeatureFlags(
  previousLightweight: boolean | undefined,
  nextLightweight: boolean
) {
  if (previousLightweight === true && nextLightweight === false) {
    posthog.reloadFeatureFlags();
  }
}

export function initializePostHogBrowser(
  env: PostHogEnv = process.env,
  logger: Pick<Console, 'warn'> = console,
  options: InitializePostHogBrowserOptions = {}
) {
  const projectToken = env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();

  if (!projectToken) {
    isPostHogBrowserDisabled = true;
    clearPostHogLoadedStateCheck();
    pendingPostHogPageviewUrls.length = 0;

    if (isPostHogDevelopmentMode(env)) {
      logger.warn(MISSING_TOKEN_WARNING);
    }
    return;
  }

  isPostHogBrowserDisabled = false;

  const lightweight = isLightweightPostHogSurface(options);

  if (hasInitializedPostHogBrowser) {
    if (lastConfiguredPostHogLightweight !== lightweight) {
      const clientConfig = buildPostHogClientConfig(env, projectToken, {
        lightweight,
      });
      const { loaded: _loaded, ...runtimeConfig } = clientConfig;
      const previousLightweight = lastConfiguredPostHogLightweight;
      posthog.set_config(runtimeConfig);
      lastConfiguredPostHogLightweight = lightweight;
      maybeReloadPostHogFeatureFlags(previousLightweight, lightweight);
    }
    return;
  }

  const clientConfig = buildPostHogClientConfig(env, projectToken, {
    lightweight,
  });
  const { advancedDisableFlags, initConfig } =
    splitPostHogInitConfig(clientConfig);
  const clientLoaded = clientConfig.loaded;

  try {
    posthog.init(projectToken, {
      ...initConfig,
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
    applyPostHogFlagDisableConfig(advancedDisableFlags);
    hasInitializedPostHogBrowser = true;
    lastConfiguredPostHogLightweight = lightweight;
    postHogLoadedStateCheckAttempts = 0;
    flushPendingPostHogPageviewsIfClientLoaded();
    schedulePostHogLoadedStateCheck();
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
  schedulePostHogLoadedStateCheck();
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
  clearPostHogLoadedStateCheck();
  flushPendingPostHogPageviews();
}

function clearPostHogLoadedStateCheck() {
  if (postHogLoadedStateCheckTimer === undefined) {
    return;
  }

  globalThis.clearTimeout(postHogLoadedStateCheckTimer);
  postHogLoadedStateCheckTimer = undefined;
}

function schedulePostHogLoadedStateCheck() {
  if (
    postHogLoadedStateCheckTimer !== undefined ||
    isPostHogReadyForCapture ||
    !hasInitializedPostHogBrowser ||
    pendingPostHogPageviewUrls.length === 0 ||
    postHogLoadedStateCheckAttempts >= POSTHOG_LOADED_STATE_CHECK_ATTEMPTS
  ) {
    return;
  }

  postHogLoadedStateCheckTimer = globalThis.setTimeout(() => {
    postHogLoadedStateCheckTimer = undefined;
    flushPendingPostHogPageviewsIfClientLoaded();

    if (isPostHogReadyForCapture || pendingPostHogPageviewUrls.length === 0) {
      return;
    }

    postHogLoadedStateCheckAttempts += 1;
    schedulePostHogLoadedStateCheck();
  }, POSTHOG_LOADED_STATE_CHECK_INTERVAL_MS);
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
