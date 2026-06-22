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

export function isPublicBlogPathname(pathname: string | null | undefined) {
  const normalizedPathname = pathname?.split(/[?#]/, 1)[0]?.trim() || '/';
  const segments = normalizedPathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return false;
  }

  const firstSegment = segments[0]?.toLowerCase() ?? '';
  if (PLATFORM_RESERVED_FIRST_SEGMENTS.has(firstSegment)) {
    return false;
  }

  return (
    firstSegment === 'blog' ||
    (segments.length >= 2 && segments[1]?.toLowerCase() === 'blog')
  );
}
