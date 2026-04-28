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
  const hostname = stripPort(getRequestHost(request)).replace(/^www\./, '');
  const normalizedRootDomain = rootDomain.toLowerCase();

  if (!hostname || hostname === normalizedRootDomain) {
    return '';
  }

  if (isLocalhostIdentifier(hostname)) {
    return '';
  }

  if (hostname.endsWith(`.${normalizedRootDomain}`)) {
    return hostname.slice(0, -(normalizedRootDomain.length + 1));
  }

  return hostname;
}

export function buildRequestBaseUrl(request: Request): string {
  const requestUrl = new URL(request.url);
  return `${requestUrl.protocol}//${getRequestHost(request)}`;
}
