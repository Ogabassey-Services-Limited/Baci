const DEFAULT_STOREFRONT_API_BASE_URL = 'https://ogabassey.com';
const PLATFORM_ROOT_HOSTS = new Set(['usebaci.com', 'www.usebaci.com']);

function normalizeStorefrontApiUrl(candidate?: string | null): string | null {
  const trimmed = candidate?.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (PLATFORM_ROOT_HOSTS.has(parsed.hostname.toLowerCase())) {
      return null;
    }

    parsed.pathname = '';
    parsed.search = '';
    parsed.hash = '';

    return parsed.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function resolveStorefrontApiBaseUrl(
  configuredUrl?: string | null,
  fallbackUrl: string = DEFAULT_STOREFRONT_API_BASE_URL
): string {
  return (
    normalizeStorefrontApiUrl(configuredUrl) ??
    normalizeStorefrontApiUrl(fallbackUrl) ??
    DEFAULT_STOREFRONT_API_BASE_URL
  );
}
