import posthog from 'posthog-js';

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
    posthog.capture(event, stamped);
  } catch {
    // Telemetry is best-effort — never surface capture failures to the user.
  }
}
