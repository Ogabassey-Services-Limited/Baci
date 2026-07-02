import { DEFAULT_ROOT_DOMAIN } from '@/lib/default-root-domain';

export type StorefrontInternalPreflightFailOpenReason =
  | 'no-secret'
  | 'no-base-url'
  | 'redirect'
  | `http-${number}`
  | 'non-json'
  | 'parse'
  | 'has-error'
  | 'unsafe-redirect'
  | 'timeout'
  | 'fetch-error';

type StorefrontInternalPreflightSurface =
  | 'blog-post-status'
  | 'product-canonical'
  | 'product-slug';

interface StorefrontInternalPreflightContext {
  surface: StorefrontInternalPreflightSurface;
  identifier: string;
  slug: string;
  reason: StorefrontInternalPreflightFailOpenReason;
  status?: number;
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]' ||
      hostname === '::1'
    );
  } catch {
    return false;
  }
}

function normalizeTrustedInternalBaseUrl(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    if (url.username || url.password) return null;
    if (url.protocol !== 'https:' && !isLoopbackOrigin(url.origin)) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function isProductionDeploymentEnvironment() {
  const vercelEnv = process.env.VERCEL_ENV?.trim();
  if (vercelEnv) return vercelEnv === 'production';

  return process.env.NODE_ENV === 'production';
}

function resolveBaseUrl(origin: string): string | null {
  const configuredRootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim();
  const rootDomain =
    configuredRootDomain ||
    (isProductionDeploymentEnvironment() ? DEFAULT_ROOT_DOMAIN : undefined);
  const configuredBaseUrl = normalizeTrustedInternalBaseUrl(rootDomain);

  if (configuredBaseUrl) return configuredBaseUrl;

  return isLoopbackOrigin(origin) ? origin : null;
}

function warnFailOpen(context: StorefrontInternalPreflightContext) {
  console.warn('[storefront-internal-preflight] fail-open', context);
}

function isJsonResponse(response: Response) {
  return response.headers.get('content-type')?.toLowerCase().includes('json');
}

async function readJsonResponse(
  response: Response,
  context: Omit<StorefrontInternalPreflightContext, 'reason'>
): Promise<unknown | null> {
  if (response.status >= 300 && response.status < 400) {
    warnFailOpen({
      ...context,
      reason: 'redirect',
      status: response.status,
    });
    return null;
  }

  if (!response.ok) {
    warnFailOpen({
      ...context,
      reason: `http-${response.status}`,
      status: response.status,
    });
    return null;
  }

  if (!isJsonResponse(response)) {
    warnFailOpen({
      ...context,
      reason: 'non-json',
      status: response.status,
    });
    return null;
  }

  try {
    return await response.json();
  } catch {
    warnFailOpen({
      ...context,
      reason: 'parse',
      status: response.status,
    });
    return null;
  }
}

function getFetchErrorReason(
  error: unknown
): StorefrontInternalPreflightFailOpenReason {
  if (
    error instanceof DOMException &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  ) {
    return 'timeout';
  }

  return 'fetch-error';
}

export const storefrontInternalPreflight = {
  getFetchErrorReason,
  readJsonResponse,
  resolveBaseUrl,
  warnFailOpen,
};
