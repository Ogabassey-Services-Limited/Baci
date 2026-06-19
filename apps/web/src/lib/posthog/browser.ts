import posthog from 'posthog-js';
import { buildPostHogClientConfig } from '@/lib/posthog/client-config';
import type { PostHogEnv } from '@/lib/posthog/config';

const MISSING_TOKEN_WARNING =
  '[PostHog] NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is missing; web analytics and error capture are disabled.';

let hasInitializedPostHogBrowser = false;

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

  posthog.init(projectToken, buildPostHogClientConfig(env));
  hasInitializedPostHogBrowser = true;
}

export function capturePostHogPageview(currentUrl?: string) {
  if (!hasInitializedPostHogBrowser) {
    return;
  }

  const resolvedUrl =
    currentUrl ||
    (typeof globalThis.location === 'undefined'
      ? undefined
      : globalThis.location.href);

  if (!resolvedUrl) {
    return;
  }

  posthog.capture('$pageview', {
    $current_url: resolvedUrl,
  });
}
