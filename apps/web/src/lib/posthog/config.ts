export const DEFAULT_POSTHOG_INGEST_HOST = 'https://eu.i.posthog.com';
export const DEFAULT_POSTHOG_ASSETS_HOST = 'https://eu-assets.i.posthog.com';
export const DEFAULT_POSTHOG_UI_HOST = 'https://eu.posthog.com';
export const DEFAULT_POSTHOG_PROXY_PATH = '/baci-relay';
const RESERVED_POSTHOG_PROXY_PATH_PREFIXES = [
  '/api',
  '/_next',
  '/admin',
  '/auth',
  '/builder',
  '/checkout',
  '/dashboard',
  '/login',
  '/logout',
  '/track',
] as const;

export type PostHogEnv = Record<string, string | undefined>;

export function normalizePostHogProxyPath(value?: string | null): string {
  const trimmed = value?.trim();

  if (!trimmed) {
    return DEFAULT_POSTHOG_PROXY_PATH;
  }

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const normalized =
    withLeadingSlash.replace(/\/+$/, '') || DEFAULT_POSTHOG_PROXY_PATH;

  return isReservedPostHogProxyPath(normalized)
    ? DEFAULT_POSTHOG_PROXY_PATH
    : normalized;
}

function isReservedPostHogProxyPath(pathname: string): boolean {
  const normalized = pathname.toLowerCase();
  return RESERVED_POSTHOG_PROXY_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
}

export function normalizePostHogHost(value: string | undefined): string {
  return value?.trim().replace(/\/+$/, '') ?? '';
}

export function getPostHogIngestHost(env: PostHogEnv = process.env): string {
  return (
    normalizePostHogHost(env.NEXT_PUBLIC_POSTHOG_HOST) ||
    DEFAULT_POSTHOG_INGEST_HOST
  );
}

export function getPostHogAssetsHost(env: PostHogEnv = process.env): string {
  return (
    normalizePostHogHost(env.NEXT_PUBLIC_POSTHOG_ASSETS_HOST) ||
    DEFAULT_POSTHOG_ASSETS_HOST
  );
}

export function getPostHogUiHost(env: PostHogEnv = process.env): string {
  return (
    normalizePostHogHost(env.NEXT_PUBLIC_POSTHOG_UI_HOST) ||
    DEFAULT_POSTHOG_UI_HOST
  );
}

export function getPostHogProxyPath(env: PostHogEnv = process.env): string {
  return normalizePostHogProxyPath(env.NEXT_PUBLIC_POSTHOG_PROXY_PATH);
}

export function isPostHogSourceMapUploadEnabled(
  env: PostHogEnv = process.env
): boolean {
  return Boolean(env.POSTHOG_API_KEY?.trim() && env.POSTHOG_PROJECT_ID?.trim());
}

export function getPostHogReleaseVersion(
  env: PostHogEnv = process.env
): string | undefined {
  return (
    env.POSTHOG_RELEASE_VERSION?.trim() ||
    env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    env.GITHUB_SHA?.trim() ||
    undefined
  );
}
