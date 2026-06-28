import { getAppUrl, getRootDomain } from '@/env';

const HOSTNAME_PATTERN =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;
const IPV4_LOOPBACK_PATTERN = /^127(?:\.\d{1,3}){3}$/;

type StorefrontOAuthMerchant = {
  custom_domain?: string | null;
  slug: string;
};

function normalizeHostname(hostname: string): string | null {
  const normalized = hostname
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();

  if (!normalized || !HOSTNAME_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
}

function toHttpsOrigin(hostname: string): string | null {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return null;

  return new URL(`https://${normalized}`).origin;
}

function buildTrustedStorefrontRedirectOrigins(
  merchant: StorefrontOAuthMerchant
): Set<string> {
  const trustedOrigins = new Set<string>();
  trustedOrigins.add(new URL(getAppUrl()).origin);

  const rootDomain = normalizeHostname(getRootDomain() || 'usebaci.com');
  const normalizedSlug = merchant.slug.trim().toLowerCase();
  if (rootDomain && normalizedSlug) {
    const subdomainOrigin = toHttpsOrigin(`${normalizedSlug}.${rootDomain}`);
    if (subdomainOrigin) trustedOrigins.add(subdomainOrigin);
  }

  if (merchant.custom_domain) {
    const customDomainOrigin = toHttpsOrigin(merchant.custom_domain);
    if (customDomainOrigin) trustedOrigins.add(customDomainOrigin);
  }

  return trustedOrigins;
}

function isDevelopmentLoopbackRedirect(parsed: URL): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '[::1]' ||
    hostname === '::1' ||
    IPV4_LOOPBACK_PATTERN.test(hostname)
  );
}

export function resolveTrustedStorefrontRedirectUrl(
  redirectUrl: string | undefined,
  merchant: StorefrontOAuthMerchant
): string | null {
  const appOrigin = new URL(getAppUrl()).origin;

  if (!redirectUrl) {
    return new URL('/account', appOrigin).toString();
  }

  try {
    const parsed = redirectUrl.startsWith('/')
      ? new URL(redirectUrl, appOrigin)
      : new URL(redirectUrl);

    if (!buildTrustedStorefrontRedirectOrigins(merchant).has(parsed.origin)) {
      if (isDevelopmentLoopbackRedirect(parsed)) {
        return parsed.toString();
      }

      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}
