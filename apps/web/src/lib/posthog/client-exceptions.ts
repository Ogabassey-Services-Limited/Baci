'use client';

import { sanitizePostHogProperties } from '@/lib/posthog/client-config';
import { sanitizePostHogException } from '@/lib/posthog/exception-sanitizer';

/**
 * Reports a handled browser exception to PostHog.
 *
 * The `posthog-js` browser SDK (~75 KB gzipped) is loaded LAZILY here via a
 * dynamic `import('posthog-js')` rather than a top-level import. This module is
 * statically imported by every `error.tsx` boundary (through
 * `useBoundaryErrorReport`), and error-boundary client modules ship in each
 * route's INITIAL client bundle so the boundary can render if a client error
 * throws. A top-level `import posthog from 'posthog-js'` therefore pulled the
 * full SDK onto the home boot path (measured in the LCP window at ~878ms on
 * ogabassey.com) even though PostHog init is otherwise idle-deferred by
 * `PostHogClientBootstrap` / `scheduleIdleBoot`. Deferring the import to the
 * moment an exception is actually captured keeps the SDK chunk out of the eager
 * home graph. The dynamic import resolves from module cache once the idle boot
 * has already loaded posthog-js through `lib/posthog/browser.ts`, so the common
 * case adds no extra network cost.
 *
 * The return value reports whether capture was *attempted* (token present); the
 * actual capture completes asynchronously after the SDK chunk resolves. Error
 * and property sanitization runs synchronously at call time so the captured
 * payload reflects the caller's exact context, not a later frame.
 */
export function captureClientException(
  error: unknown,
  properties?: Record<string, unknown>
): boolean {
  if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) {
    return false;
  }

  const sanitizedError = sanitizePostHogException(error);
  // Stamp the failing page's URL/pathname SYNCHRONOUSLY, before the deferred
  // SDK import: posthog-js derives `$current_url`/`$pathname` at capture
  // time, so an error-boundary reset, navigation or chunk-recovery reload
  // racing the import would attribute the exception to the LATER page (same
  // convention as `withOriginUrl` in web-vitals-queue.ts). Stamped after the
  // caller spread so, like `app_surface`/`runtime`, callers cannot spoof it;
  // the URL property sanitizer redacts the query/hash.
  const location = globalThis.location;
  const sanitizedProperties = sanitizePostHogProperties({
    ...properties,
    ...(location
      ? { $current_url: location.href, $pathname: location.pathname }
      : {}),
    app_surface: 'web',
    runtime: 'browser',
  });

  void import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.captureException(sanitizedError, sanitizedProperties);
    })
    .catch(() => {
      // Exception capture is best-effort: never let an SDK load/capture
      // failure surface out of an error boundary's report path.
    });

  return true;
}
