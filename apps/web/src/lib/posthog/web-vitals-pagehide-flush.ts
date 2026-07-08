import {
  buildPostHogCaptureUrl,
  isLikelyBotUserAgent,
  sendBootFreeCaptureEvent,
} from '@/lib/posthog/boot-free-capture';
import {
  resolvePostHogWebTenantContext,
  sanitizePostHogProperties,
} from '@/lib/posthog/client-config';
import { getPostHogBrowserEnv, type PostHogEnv } from '@/lib/posthog/config';
import {
  getPostHogPersistenceKey,
  readPostHogPersistedIdentity,
  readPostHogPersistenceRecord,
} from '@/lib/posthog/persisted-identity';
import {
  drainPendingPostHogWebVitals,
  type PostHogWebVitalsPayload,
} from '@/lib/posthog/web-vitals-queue';

/**
 * Page-hide flush for queued web-vitals, WITHOUT booting posthog-js.
 *
 * The queue's only other flush trigger is PostHog's deferred idle boot (≤4s),
 * so every session that ends before boot — disproportionately the slow
 * TTFB/LCP cohort this campaign targets — silently dropped its vitals:
 * survivorship bias that makes field data read optimistically. This module
 * beacons the queued metrics directly to the first-party relay capture path
 * when the page is hidden (`visibilitychange` → hidden, plus `pagehide` as
 * the Safari fallback).
 *
 * Ordering guarantee: web-vitals v5 emits final CLS/INP/LCP synchronously in
 * a `visibilitychange` handler registered with `capture: true` on `window`;
 * our listener targets `document`, which runs AFTER window-capture handlers,
 * so the queue already holds the final values when we drain.
 *
 * Dedupe: `drainPendingPostHogWebVitals()` splices — a later posthog boot
 * flushes an empty queue, and a boot-first flush leaves nothing to beacon.
 *
 * bfcache-safe: neither listener blocks back/forward cache (only
 * unload/beforeunload would).
 */

let armed = false;
let attachedListeners: Array<{
  target: EventTarget;
  type: string;
  handler: EventListener;
}> = [];

function isDocumentPrerendering(): boolean {
  return (
    (document as Document & { prerendering?: boolean }).prerendering === true
  );
}

function generateDistinctId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `web-vitals-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2)}`
  );
}

function seedSdkDistinctId(projectToken: string, distinctId: string): boolean {
  try {
    const storage = globalThis.localStorage;
    if (!storage) {
      return false;
    }
    const storageKey = getPostHogPersistenceKey(projectToken);
    const existingPersistence =
      readPostHogPersistenceRecord(projectToken) ?? {};
    storage.setItem(
      storageKey,
      JSON.stringify({
        ...existingPersistence,
        $device_id: distinctId,
        distinct_id: distinctId,
      })
    );
    return true;
  } catch {
    return false;
  }
}

// Storage-blocked fallback: remembers the generated id per token so repeated
// hidden→restored→hidden flushes before boot keep ONE identity instead of
// minting a fresh id per flush (mirrors the public-blog beacon's in-memory
// map). Module-lifetime only — cleared on navigation like the block itself.
const inMemoryDistinctIds = new Map<string, string>();

/** Persisted SDK identity when present so a later boot on this origin adopts
 * the same id; otherwise generate and seed (mirrors the public-blog beacon,
 * minus its blog-specific legacy key), remembering the id in memory when
 * storage is blocked so consecutive flushes share it. */
function getOrCreateDistinctId(projectToken: string): string {
  const { distinctId, deviceId } = readPostHogPersistedIdentity(projectToken);
  if (distinctId) {
    return distinctId;
  }
  if (deviceId) {
    return deviceId;
  }

  const remembered = inMemoryDistinctIds.get(projectToken);
  if (remembered) {
    return remembered;
  }

  const generated = generateDistinctId();
  if (seedSdkDistinctId(projectToken, generated)) {
    inMemoryDistinctIds.delete(projectToken);
  } else {
    inMemoryDistinctIds.set(projectToken, generated);
  }
  return generated;
}

// Fallback base only for parsing a relative pinned URL; a real browser always
// pins the absolute `location.href`, so this is just defensive.
const BEACON_ORIGIN_URL_FALLBACK_BASE = 'https://usebaci.com';

interface BeaconOriginContext {
  host: string;
  tenantContext: Record<string, unknown>;
}

/**
 * Resolve the beacon's `$host` and merchant tenant fields from the metric's
 * OWN pinned origin URL (`$current_url`), NOT the live `location`. A queued
 * vital can flush after a client-side navigation to a different merchant/route
 * (e.g. `usebaci.com/merchantA` → `/merchantB`); the metric URL is pinned at
 * capture time, so tenant attribution must follow it or the beacon would stamp
 * the later merchant onto page A's measurement, corrupting multi-tenant CWV
 * attribution. Mirrors `capturePublicBlogPageview`. Falls back to the live
 * location only for payloads enqueued without a pinned URL.
 */
function resolveBeaconOriginContext(
  env: PostHogEnv,
  payload: PostHogWebVitalsPayload
): BeaconOriginContext {
  const currentUrl =
    typeof payload.$current_url === 'string' ? payload.$current_url : undefined;
  if (currentUrl) {
    try {
      const url = new URL(currentUrl, BEACON_ORIGIN_URL_FALLBACK_BASE);
      return {
        host: url.hostname,
        tenantContext: resolvePostHogWebTenantContext(env, {
          hostname: url.hostname,
          pathname: url.pathname,
        }),
      };
    } catch {
      // Malformed pinned URL: fall back to the live location below.
    }
  }

  return {
    host: globalThis.location?.hostname ?? '',
    tenantContext: resolvePostHogWebTenantContext(env),
  };
}

export function flushWebVitalsBeacon(
  env: PostHogEnv = getPostHogBrowserEnv()
): number {
  if (typeof document === 'undefined' || isDocumentPrerendering()) {
    return 0;
  }
  if (isLikelyBotUserAgent()) {
    // Raw capture bypasses posthog-js bot filtering; drop rather than pollute.
    drainPendingPostHogWebVitals();
    return 0;
  }

  // Trim to match initializePostHogBrowser / capturePublicBlogPageview: an
  // env value with stray whitespace must yield the SAME api_key and the SAME
  // persistence key, or bounce-before-boot beacons get a divergent identity.
  const projectToken = env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();
  if (!projectToken) {
    return 0;
  }

  const payloads = drainPendingPostHogWebVitals();
  if (payloads.length === 0) {
    return 0;
  }

  const url = buildPostHogCaptureUrl(env);
  const distinctId = getOrCreateDistinctId(projectToken);

  let sent = 0;
  for (const payload of payloads) {
    const { host, tenantContext } = resolveBeaconOriginContext(env, payload);
    const properties = {
      // Full before_send parity: email-scrub on every string value plus
      // URL-query redaction on URL-keyed fields, matching the booted path's
      // sanitizePostHogCapture. The raw beacon bypasses before_send entirely,
      // so without this the same event would carry weaker PII guarantees.
      ...sanitizePostHogProperties(payload),
      ...tenantContext,
      $host: host,
      // No person profile for boot-free captures (identified_only semantics).
      $process_person_profile: false,
      app_surface: 'web',
      // Transport marker so HogQL/health checks can account per-path and
      // dedupe against posthog-js-captured events.
      capture_mode: 'pagehide_beacon',
      distinct_id: distinctId,
      token: projectToken,
    };

    const body = JSON.stringify({
      api_key: projectToken,
      distinct_id: distinctId,
      event: 'web_vitals',
      properties,
    });

    if (sendBootFreeCaptureEvent(url, body)) {
      sent += 1;
    }
  }

  return sent;
}

/**
 * Arm the page-hide flush listeners (idempotent). Call once from the
 * web-vitals reporter alongside metric registration.
 */
export function armWebVitalsPageHideFlush(env?: PostHogEnv): void {
  if (armed || typeof document === 'undefined') {
    return;
  }
  armed = true;

  const onHidden = () => {
    if (document.visibilityState === 'hidden') {
      flushWebVitalsBeacon(env);
    }
  };

  const onPageHide = () => flushWebVitalsBeacon(env);

  // Document target ⇒ runs after web-vitals' window-capture final emissions.
  document.addEventListener('visibilitychange', onHidden);
  // Safari fallback: pagehide fires where visibilitychange historically
  // did not; flushWebVitalsBeacon is drain-based so double-firing is a no-op.
  window.addEventListener('pagehide', onPageHide);
  attachedListeners = [
    { target: document, type: 'visibilitychange', handler: onHidden },
    { target: window, type: 'pagehide', handler: onPageHide },
  ];
}

/** Test-only: reset the idempotence latch and detach real DOM listeners so
 * re-arming across tests cannot accumulate stale handlers. */
export function resetWebVitalsPageHideFlushForTesting(): void {
  armed = false;
  for (const { target, type, handler } of attachedListeners) {
    target.removeEventListener(type, handler);
  }
  attachedListeners = [];
  inMemoryDistinctIds.clear();
}
