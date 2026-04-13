import { BACI_ADMIN_SCHEME } from '@baci/shared';

const BACI_WEB_HOSTS = new Set(['usebaci.com', 'www.usebaci.com']);

function getRouteKey(url: URL): string {
  const segments = [url.hostname, ...url.pathname.split('/')]
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean);

  return segments.join('/');
}

function shouldLaunchRootApp(url: URL): boolean {
  if (url.protocol === `${BACI_ADMIN_SCHEME}:`) {
    const routeKey = getRouteKey(url);
    return routeKey.startsWith('dashboard') || routeKey.startsWith('admin');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return false;
  }

  if (!BACI_WEB_HOSTS.has(url.hostname.toLowerCase())) {
    return false;
  }

  const normalizedPathname = url.pathname.toLowerCase();

  return (
    normalizedPathname === '/dashboard' ||
    normalizedPathname.startsWith('/dashboard/') ||
    normalizedPathname === '/admin' ||
    normalizedPathname.startsWith('/admin/')
  );
}

export function rewriteBaciDeepLinkPath(path: string): string {
  try {
    const url = new URL(path, 'https://usebaci.com');
    return shouldLaunchRootApp(url) ? '/' : path;
  } catch {
    return path;
  }
}
