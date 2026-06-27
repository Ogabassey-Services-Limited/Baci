import { getPostHogProxyPath, type PostHogEnv } from '@/lib/posthog/config';

const PUBLIC_BLOG_DISTINCT_ID_KEY = 'baci_public_blog_distinct_id';
const POSTHOG_CAPTURE_ENDPOINT = '/capture/';
const QUERY_OR_HASH_PATTERN = /[?#]/;

let lastCapturedPublicBlogPageviewUrl: string | undefined;

function redactUrlQuery(value: string): string {
  const markerIndex = value.search(QUERY_OR_HASH_PATTERN);
  return markerIndex === -1 ? value : value.slice(0, markerIndex);
}

function resolveCurrentUrl(currentUrl?: string): string | undefined {
  return (
    currentUrl ||
    (typeof globalThis.location === 'undefined'
      ? undefined
      : globalThis.location.href)
  );
}

function getOrCreatePublicBlogDistinctId(): string {
  try {
    const stored = globalThis.localStorage?.getItem(
      PUBLIC_BLOG_DISTINCT_ID_KEY
    );

    if (stored) {
      return stored;
    }

    const generated =
      globalThis.crypto?.randomUUID?.() ??
      `public-blog-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2)}`;

    globalThis.localStorage?.setItem(PUBLIC_BLOG_DISTINCT_ID_KEY, generated);
    return generated;
  } catch {
    return 'public-blog-anonymous';
  }
}

function buildPostHogCaptureUrl(env: PostHogEnv): string {
  return `${getPostHogProxyPath(env)}${POSTHOG_CAPTURE_ENDPOINT}`;
}

function sendPublicBlogCapture(captureUrl: string, body: string): void {
  const beacon = globalThis.navigator?.sendBeacon;

  if (typeof beacon === 'function') {
    const payload = new Blob([body], { type: 'application/json' });

    if (beacon.call(globalThis.navigator, captureUrl, payload)) {
      return;
    }
  }

  void globalThis
    .fetch?.(captureUrl, {
      body,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      method: 'POST',
    })
    ?.catch(() => undefined);
}

export function capturePublicBlogPageview(
  env: PostHogEnv = process.env,
  currentUrl = resolveCurrentUrl()
): void {
  const projectToken = env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();

  if (!projectToken || !currentUrl) {
    return;
  }

  const sanitizedUrl = redactUrlQuery(currentUrl);

  if (lastCapturedPublicBlogPageviewUrl === currentUrl) {
    return;
  }

  lastCapturedPublicBlogPageviewUrl = currentUrl;

  const captureUrl = buildPostHogCaptureUrl(env);
  const url = new URL(sanitizedUrl, globalThis.location?.origin);
  const distinctId = getOrCreatePublicBlogDistinctId();
  const body = JSON.stringify({
    api_key: projectToken,
    distinct_id: distinctId,
    event: '$pageview',
    properties: {
      $current_url: sanitizedUrl,
      $host: url.hostname,
      $pathname: url.pathname,
      app_surface: 'web',
      capture_mode: 'public_blog_lightweight',
      distinct_id: distinctId,
      token: projectToken,
    },
  });

  sendPublicBlogCapture(captureUrl, body);
}

export function resetPublicBlogPageviewDedupeForTests(): void {
  lastCapturedPublicBlogPageviewUrl = undefined;
}
