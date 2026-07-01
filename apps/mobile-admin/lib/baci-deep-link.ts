import { BACI_ADMIN_SCHEME } from '@baci/shared';

const BACI_WEB_HOSTS = new Set(['usebaci.com', 'www.usebaci.com']);

function getRouteKey(url: URL): string {
  const segments = [url.hostname, ...url.pathname.split('/')]
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean);

  return segments.join('/');
}

function getPrimaryRouteSegment(url: URL): string {
  if (url.protocol === `${BACI_ADMIN_SCHEME}:`) {
    return getRouteKey(url).split('/')[0] ?? '';
  }

  return (
    url.pathname
      .split('/')
      .map((segment) => segment.trim().toLowerCase())
      .filter(Boolean)[0] ?? ''
  );
}

function getInviteRoutePath(url: URL): string | null {
  if (
    url.protocol !== `${BACI_ADMIN_SCHEME}:` &&
    !['http:', 'https:'].includes(url.protocol)
  ) {
    return null;
  }

  if (
    ['http:', 'https:'].includes(url.protocol) &&
    !BACI_WEB_HOSTS.has(url.hostname.toLowerCase())
  ) {
    return null;
  }

  const segments =
    url.protocol === `${BACI_ADMIN_SCHEME}:`
      ? [url.hostname, ...url.pathname.split('/')]
      : url.pathname.split('/');
  const routeSegments = segments
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (routeSegments[0]?.toLowerCase() !== 'invite' || !routeSegments[1]) {
    return null;
  }

  return `/${routeSegments.join('/')}${url.search}`;
}

function shouldLaunchRootApp(url: URL): boolean {
  if (url.protocol === `${BACI_ADMIN_SCHEME}:`) {
    const primaryRouteSegment = getPrimaryRouteSegment(url);
    return (
      primaryRouteSegment === 'dashboard' || primaryRouteSegment === 'admin'
    );
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return false;
  }

  if (!BACI_WEB_HOSTS.has(url.hostname.toLowerCase())) {
    return false;
  }

  const primaryRouteSegment = getPrimaryRouteSegment(url);
  return primaryRouteSegment === 'dashboard' || primaryRouteSegment === 'admin';
}

function parseSupportedAbsoluteUrl(path: string): URL | null {
  try {
    const url = new URL(path);

    if (
      url.protocol !== `${BACI_ADMIN_SCHEME}:` &&
      url.protocol !== 'http:' &&
      url.protocol !== 'https:'
    ) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

export function rewriteBaciDeepLinkPath(path: string): string {
  const url = parseSupportedAbsoluteUrl(path);

  if (!url) {
    return path;
  }

  const inviteRoutePath = getInviteRoutePath(url);
  if (inviteRoutePath) {
    return inviteRoutePath;
  }

  return shouldLaunchRootApp(url) ? '/' : path;
}
