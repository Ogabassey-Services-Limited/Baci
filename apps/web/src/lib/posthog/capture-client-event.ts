import posthog from 'posthog-js';

const MAX_PENDING_CLIENT_EVENTS = 20;

interface PendingClientEvent {
  event: string;
  properties: Record<string, unknown>;
}

let pendingClientEvents: PendingClientEvent[] = [];

function isPostHogClientLoaded(): boolean {
  // Mirrors browser.ts: `posthog-js` flips `__loaded` at the end of `init()`;
  // captures before that are dropped by the SDK. Re-check this on SDK bumps.
  return posthog.__loaded === true;
}

/**
 * Fire-and-forget product-event capture for the browser. The app has no generic
 * capture helper (only `$pageview`/`web_vitals`/exception paths in
 * `lib/posthog/browser.ts`); this wraps `posthog-js` so wallet-funding surfaces
 * can emit custom events without importing the SDK directly.
 *
 * Telemetry must never break a user flow, so every call is wrapped in try/catch.
 * `undefined` property values are dropped (keeps `merchant_slug`/`customer_id`
 * absent rather than reporting `undefined`), and every event is stamped with
 * `app_surface: 'web'` to match the existing pageview capture — stamped after
 * property copying so callers cannot override it.
 *
 * The bootstrap defers `posthog.init` until idle/first interaction, so events
 * captured before init are queued (bounded) and delivered when the bootstrap
 * calls `flushPendingClientEvents` — first-load surface events would otherwise
 * be silently discarded by the SDK.
 */
export function captureClientEvent(
  event: string,
  properties?: Record<string, unknown>
): void {
  try {
    const stamped: Record<string, unknown> = {};
    if (properties) {
      for (const [key, value] of Object.entries(properties)) {
        if (value !== undefined) {
          stamped[key] = value;
        }
      }
    }
    stamped.app_surface = 'web';

    if (!isPostHogClientLoaded()) {
      pendingClientEvents = [
        ...pendingClientEvents,
        { event, properties: stamped },
      ].slice(-MAX_PENDING_CLIENT_EVENTS);
      return;
    }

    posthog.capture(event, stamped);
  } catch {
    // Telemetry is best-effort — never surface capture failures to the user.
  }
}

/**
 * Delivers events captured before the SDK initialized. Called by the browser
 * bootstrap (`markPostHogReadyAndFlush` in `lib/posthog/browser.ts`) once
 * `init()` completes.
 */
export function flushPendingClientEvents(): void {
  const queued = pendingClientEvents;
  pendingClientEvents = [];

  for (const { event, properties } of queued) {
    try {
      posthog.capture(event, properties);
    } catch {
      // Best-effort — a failed pre-init event is dropped, not retried.
    }
  }
}
