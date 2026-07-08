import { getPostHogProxyPath, type PostHogEnv } from '@/lib/posthog/config';

/**
 * Shared helpers for capturing PostHog events WITHOUT booting posthog-js —
 * used by the public-blog pageview beacon and the web-vitals page-hide flush.
 * Raw capture bypasses posthog-js's bot filtering and `before_send`
 * sanitization, so callers must apply `isLikelyBotUserAgent` and
 * `redactUrlQuery` themselves.
 */

export const POSTHOG_CAPTURE_ENDPOINT = '/i/v0/e/';

const QUERY_OR_HASH_PATTERN = /[?#]/;

const LIKELY_BOT_USER_AGENT_PATTERN =
  /(?:bot|crawler|spider|chrome-lighthouse|pagespeed|headlesschrome|google-inspectiontool|googleother|siteauditbot|semrushbot|ahrefsbot|gptbot|oai-searchbot|chatgpt-user|perplexitybot|vercelbot|facebookexternal|twitterbot|linkedinbot|slackbot)/i;

/** Strip query/hash — the boot-free path must mirror `before_send`'s URL
 * redaction (client-config `sanitizePostHogCapture`) manually. */
export function redactUrlQuery(value: string): string {
  const markerIndex = value.search(QUERY_OR_HASH_PATTERN);
  return markerIndex === -1 ? value : value.slice(0, markerIndex);
}

/** Raw capture bypasses posthog-js bot filtering — gate on UA ourselves. */
export function isLikelyBotUserAgent(): boolean {
  try {
    const userAgent = globalThis.navigator?.userAgent;
    return Boolean(userAgent && LIKELY_BOT_USER_AGENT_PATTERN.test(userAgent));
  } catch {
    return false;
  }
}

export function buildPostHogCaptureUrl(env: PostHogEnv): string {
  return `${getPostHogProxyPath(env)}${POSTHOG_CAPTURE_ENDPOINT}`;
}

/**
 * Deliver one capture body (uncompressed JSON, one event per POST — the shape
 * the relay accepts today) via sendBeacon, falling back to keepalive fetch
 * when beacon is unavailable or declines the payload.
 */
export function sendBootFreeCaptureEvent(url: string, body: string): boolean {
  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const delivered = navigator.sendBeacon(
        url,
        new Blob([body], { type: 'application/json' })
      );
      if (delivered) {
        return true;
      }
    }
  } catch {
    // fall through to fetch
  }

  try {
    if (typeof fetch === 'function') {
      void fetch(url, {
        body,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        method: 'POST',
      }).catch(() => {
        // Swallowed: a lost beacon must never surface as an unhandled
        // rejection during page teardown.
      });
      return true;
    }
  } catch {
    // swallowed: losing a beacon must never break page teardown
  }

  return false;
}
