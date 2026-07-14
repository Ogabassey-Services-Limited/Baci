const MAX_PENDING_CLIENT_EVENTS = 20;

type ClientEventSink = (
  event: string,
  properties: Record<string, unknown>
) => void;

interface PendingClientEvent {
  event: string;
  properties: Record<string, unknown>;
}

let sink: ClientEventSink | null = null;
let pendingClientEvents: PendingClientEvent[] = [];

/**
 * Fire-and-forget product-event capture for the browser. The app has no generic
 * capture helper (only `$pageview`/`web_vitals`/exception paths in
 * `lib/posthog/browser.ts`); this lets wallet-funding surfaces emit custom
 * events WITHOUT importing the SDK — a static `posthog-js` import here would
 * drag the SDK into every consuming route's initial bundle, defeating the
 * bootstrap's deliberate lazy dynamic-import of `lib/posthog/browser`.
 *
 * Until the bootstrap initializes and connects a sink, events queue (bounded);
 * `browser.ts` connects `posthog.capture` as the sink post-init and drains the
 * queue, so first-load surface events are neither dropped nor eagerly loaded.
 *
 * Telemetry must never break a user flow, so every call is wrapped in
 * try/catch. `undefined` property values are dropped (keeps `merchant_slug`/
 * `customer_id` absent rather than reporting `undefined`), and every event is
 * stamped with `app_surface: 'web'` after property copying so callers cannot
 * override it.
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

    if (sink) {
      sink(event, stamped);
      return;
    }

    pendingClientEvents = [
      ...pendingClientEvents,
      { event, properties: stamped },
    ].slice(-MAX_PENDING_CLIENT_EVENTS);
  } catch {
    // Telemetry is best-effort — never surface capture failures to the user.
  }
}

/**
 * Connects the live delivery path and drains the pre-init queue. Called by the
 * browser bootstrap (`markPostHogReadyAndFlush` in `lib/posthog/browser.ts`,
 * itself behind the lazy import boundary) once `posthog.init` completes.
 */
export function connectClientEventSink(nextSink: ClientEventSink): void {
  sink = nextSink;

  const queued = pendingClientEvents;
  pendingClientEvents = [];

  for (const { event, properties } of queued) {
    try {
      nextSink(event, properties);
    } catch {
      // Best-effort — a failed pre-init event is dropped, not retried.
    }
  }
}
