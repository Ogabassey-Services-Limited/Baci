import { resolvePostHogWebTenantContext } from '@/lib/posthog/client-config';
import { getPostHogProxyPath, type PostHogEnv } from '@/lib/posthog/config';

const DEFAULT_PUBLIC_BLOG_URL_BASE = 'https://usebaci.com';
const LEGACY_PUBLIC_BLOG_DISTINCT_ID_KEY = 'baci_public_blog_distinct_id';
const POSTHOG_CAPTURE_ENDPOINT = '/capture/';
const POSTHOG_SDK_PERSISTENCE_KEY_PREFIX = 'ph_';
const POSTHOG_SDK_PERSISTENCE_KEY_SUFFIX = '_posthog';
const QUERY_OR_HASH_PATTERN = /[?#]/;
const LIKELY_BOT_USER_AGENT_PATTERN =
  /(?:bot|crawler|spider|chrome-lighthouse|pagespeed|headlesschrome|google-inspectiontool|googleother|siteauditbot|semrushbot|ahrefsbot|gptbot|oai-searchbot|chatgpt-user|perplexitybot|vercelbot|facebookexternal|twitterbot|linkedinbot|slackbot)/i;

const DEFAULT_PUBLIC_BLOG_POSTHOG_ENV: PostHogEnv = {
  NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN:
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN,
  NEXT_PUBLIC_POSTHOG_PROXY_PATH: process.env.NEXT_PUBLIC_POSTHOG_PROXY_PATH,
  NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
};

let lastCapturedPublicBlogPageviewUrl: string | undefined;
const inMemoryPublicBlogDistinctIds = new Map<string, string>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getStringProperty(
  value: Record<string, unknown>,
  key: string
): string | undefined {
  const property = value[key];
  return typeof property === 'string' && property.trim() ? property : undefined;
}

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

function getBrowserOrigin(): string | undefined {
  try {
    return globalThis.location?.origin;
  } catch {
    return undefined;
  }
}

function buildSanitizedUrl(currentUrl: string): URL {
  return new URL(
    redactUrlQuery(currentUrl),
    getBrowserOrigin() ?? DEFAULT_PUBLIC_BLOG_URL_BASE
  );
}

function getPostHogSdkPersistenceKey(projectToken: string): string {
  return `${POSTHOG_SDK_PERSISTENCE_KEY_PREFIX}${projectToken}${POSTHOG_SDK_PERSISTENCE_KEY_SUFFIX}`;
}

function readStorageValue(key: string): string | undefined {
  try {
    return globalThis.localStorage?.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeStorageValue(key: string, value: string): boolean {
  try {
    if (!globalThis.localStorage) {
      return false;
    }

    globalThis.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function parsePostHogPersistenceValue(
  value: string | undefined
): Record<string, unknown> | undefined {
  if (!value) {
    return undefined;
  }

  const candidates = [value];
  try {
    candidates.push(decodeURIComponent(value));
  } catch {
    // Some storage adapters persist raw JSON. Ignore invalid URI encodings.
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (isRecord(parsed)) {
        return parsed;
      }
    } catch {
      // Try the next supported PostHog persistence encoding.
    }
  }

  return undefined;
}

function generatePublicBlogDistinctId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `public-blog-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2)}`
  );
}

function getExistingSdkDistinctId(projectToken: string): string | undefined {
  const sdkPersistence = parsePostHogPersistenceValue(
    readStorageValue(getPostHogSdkPersistenceKey(projectToken))
  );

  const sdkDistinctId = sdkPersistence
    ? getStringProperty(sdkPersistence, 'distinct_id')
    : undefined;
  if (sdkDistinctId) {
    return sdkDistinctId;
  }

  const sdkDeviceId = sdkPersistence
    ? getStringProperty(sdkPersistence, '$device_id')
    : undefined;
  if (sdkDeviceId) {
    seedSdkDistinctId(projectToken, sdkDeviceId);
    return sdkDeviceId;
  }

  const legacyDistinctId = readStorageValue(LEGACY_PUBLIC_BLOG_DISTINCT_ID_KEY);
  if (legacyDistinctId) {
    seedSdkDistinctId(projectToken, legacyDistinctId);
    return legacyDistinctId;
  }

  return undefined;
}

function seedSdkDistinctId(projectToken: string, distinctId: string): boolean {
  const storageKey = getPostHogSdkPersistenceKey(projectToken);
  const existingPersistence =
    parsePostHogPersistenceValue(readStorageValue(storageKey)) ?? {};
  const deviceId = getStringProperty(existingPersistence, '$device_id');
  const nextPersistence = {
    ...existingPersistence,
    $device_id: deviceId ?? distinctId,
    distinct_id: distinctId,
  };

  return writeStorageValue(storageKey, JSON.stringify(nextPersistence));
}

function getOrCreatePublicBlogDistinctId(projectToken: string): string {
  const existingSdkDistinctId = getExistingSdkDistinctId(projectToken);

  if (existingSdkDistinctId) {
    return existingSdkDistinctId;
  }

  const inMemoryDistinctId = inMemoryPublicBlogDistinctIds.get(projectToken);
  if (inMemoryDistinctId) {
    return inMemoryDistinctId;
  }

  const generated = generatePublicBlogDistinctId();
  if (seedSdkDistinctId(projectToken, generated)) {
    inMemoryPublicBlogDistinctIds.delete(projectToken);
  } else {
    inMemoryPublicBlogDistinctIds.set(projectToken, generated);
  }
  return generated;
}

function buildPostHogCaptureUrl(env: PostHogEnv): string {
  return `${getPostHogProxyPath(env)}${POSTHOG_CAPTURE_ENDPOINT}`;
}

function isLikelyBotUserAgent(): boolean {
  try {
    const userAgent = globalThis.navigator?.userAgent;
    return (
      typeof userAgent === 'string' &&
      LIKELY_BOT_USER_AGENT_PATTERN.test(userAgent)
    );
  } catch {
    return false;
  }
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
  env: PostHogEnv = DEFAULT_PUBLIC_BLOG_POSTHOG_ENV,
  currentUrl = resolveCurrentUrl()
): void {
  const projectToken = env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();

  if (!projectToken || !currentUrl || isLikelyBotUserAgent()) {
    return;
  }

  if (lastCapturedPublicBlogPageviewUrl === currentUrl) {
    return;
  }

  lastCapturedPublicBlogPageviewUrl = currentUrl;

  const url = buildSanitizedUrl(currentUrl);
  const sanitizedUrl = url.href;
  const captureUrl = buildPostHogCaptureUrl(env);
  const distinctId = getOrCreatePublicBlogDistinctId(projectToken);
  const tenantContext = resolvePostHogWebTenantContext(env, {
    hostname: url.hostname,
    pathname: url.pathname,
  });
  const body = JSON.stringify({
    api_key: projectToken,
    distinct_id: distinctId,
    event: '$pageview',
    properties: {
      $current_url: sanitizedUrl,
      $host: url.hostname,
      $pathname: url.pathname,
      $process_person_profile: false,
      ...tenantContext,
      app_surface: 'web',
      capture_mode: 'public_blog_lightweight',
      distinct_id: distinctId,
      token: projectToken,
    },
  });

  sendPublicBlogCapture(captureUrl, body);
}

export function resetPublicBlogPageviewDedupe(): void {
  lastCapturedPublicBlogPageviewUrl = undefined;
}

export function resetPublicBlogPageviewDedupeForTests(): void {
  resetPublicBlogPageviewDedupe();
  inMemoryPublicBlogDistinctIds.clear();
}
