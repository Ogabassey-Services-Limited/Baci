// First path segments that belong to the platform/app shell rather than a
// merchant storefront. A `blog` appearing under any of these is never a public
// storefront blog surface, so PostHog should stay in its full configuration.
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

/**
 * Returns true when `pathname` points at a public storefront blog surface.
 *
 * Matches both storefront routing shapes:
 * - custom domains (`ogabassey.com/blog/...`) where `blog` is the first segment;
 * - slug-routed storefronts (`usebaci.com/<slug>/blog/...`) where `blog` is the
 *   second segment.
 *
 * Used to initialize PostHog with a lightweight, pageview-only config on
 * SEO/content pages (no session replay, autocapture, heatmaps or `/flags`
 * request) while keeping the full instrumentation everywhere else.
 */
export function isPublicBlogPathname(
  pathname: string | null | undefined
): boolean {
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
