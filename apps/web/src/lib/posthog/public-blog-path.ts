const PLATFORM_RESERVED_FIRST_SEGMENTS = new Set([
  '_next',
  'admin',
  'api',
  'auth',
  'builder',
  'checkout',
  'dashboard',
  'feeds',
  'login',
  'logout',
  'track',
]);

const PLATFORM_PATH_MODE_HOSTS = new Set([
  '127.0.0.1',
  'localhost',
  'usebaci.com',
  'www.usebaci.com',
]);

function isPlatformPathModeHost(hostname: string | null | undefined) {
  const normalized = hostname?.split(':', 1)[0]?.toLowerCase() ?? '';
  return PLATFORM_PATH_MODE_HOSTS.has(normalized);
}

export function isPublicBlogPathname(
  pathname: string | null | undefined,
  {
    hostname = globalThis.location?.hostname,
  }: { hostname?: string | null } = {}
) {
  const normalizedPathname = pathname?.split(/[?#]/, 1)[0]?.trim() || '/';
  const segments = normalizedPathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return false;
  }

  const firstSegment = segments[0]?.toLowerCase() ?? '';
  if (PLATFORM_RESERVED_FIRST_SEGMENTS.has(firstSegment)) {
    return false;
  }

  if (firstSegment === 'blog') {
    return true;
  }

  return (
    isPlatformPathModeHost(hostname) &&
    segments.length >= 2 &&
    segments[1]?.toLowerCase() === 'blog'
  );
}
