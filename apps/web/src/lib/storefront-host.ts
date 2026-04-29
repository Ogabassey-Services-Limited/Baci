const WWW_PREFIX = 'www.';

export function getRequestHost(request: Request): string {
  const host = request.headers.get('host') || new URL(request.url).host || '';

  return host
    .split(',')[0]
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}

export function stripPort(host: string): string {
  if (host.startsWith('[')) {
    const closingBracketIndex = host.indexOf(']');
    return closingBracketIndex === -1
      ? host
      : host.slice(0, closingBracketIndex + 1);
  }

  return host.split(':')[0] || '';
}

export function isLocalhostIdentifier(hostname: string): boolean {
  return (
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  );
}

export function resolveStorefrontRouteIdentifier({
  request,
  rootDomain,
}: {
  request: Request;
  rootDomain: string;
}): string {
  return resolveStorefrontRouteIdentifierContext({ request, rootDomain })
    .identifier;
}

/**
 * Returns lookup candidates in priority order. When a custom-domain identifier
 * starts with WWW_PREFIX, prefer the proxy-aligned non-www lookup first while
 * keeping the exact www host as a fallback.
 */
export function resolveStorefrontRouteIdentifiers({
  request,
  rootDomain,
}: {
  request: Request;
  rootDomain: string;
}): string[] {
  const context = resolveStorefrontRouteIdentifierContext({
    request,
    rootDomain,
  });

  if (!context.identifier) {
    return [];
  }

  if (
    context.kind === 'custom-domain' &&
    context.identifier.startsWith(WWW_PREFIX)
  ) {
    // Match the proxy's non-www lookup while retaining exact www fallback.
    return [context.identifier.slice(WWW_PREFIX.length), context.identifier];
  }

  return [context.identifier];
}

function resolveStorefrontRouteIdentifierContext({
  request,
  rootDomain,
}: {
  request: Request;
  rootDomain: string;
}): { identifier: string; kind: 'custom-domain' | 'none' | 'subdomain' } {
  const hostname = stripPort(getRequestHost(request));
  const normalizedRootDomain = rootDomain.toLowerCase();

  if (
    !hostname ||
    hostname === normalizedRootDomain ||
    hostname === `${WWW_PREFIX}${normalizedRootDomain}`
  ) {
    return { identifier: '', kind: 'none' };
  }

  if (isLocalhostIdentifier(hostname)) {
    return { identifier: '', kind: 'none' };
  }

  if (hostname.endsWith(`.${normalizedRootDomain}`)) {
    return {
      identifier: hostname.slice(0, -(normalizedRootDomain.length + 1)),
      kind: 'subdomain',
    };
  }

  return { identifier: hostname, kind: 'custom-domain' };
}

export function buildRequestBaseUrl(request: Request): string {
  const requestUrl = new URL(request.url);
  return `${requestUrl.protocol}//${getRequestHost(request)}`;
}
