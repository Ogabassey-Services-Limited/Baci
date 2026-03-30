import {
  BACI_ADMIN_SCHEME,
  JUMIA_MOBILE_RETURN_PATH,
  JUMIA_MOBILE_RETURN_URL,
} from '@baci/shared';

const JUMIA_CALLBACK_QUERY_KEYS = ['code', 'error', 'ticketId'] as const;

function getRouteSegments(url: URL): string[] {
  return [url.hostname, ...url.pathname.split('/')]
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function isJumiaCallbackUrl(url: URL): boolean {
  return JUMIA_CALLBACK_QUERY_KEYS.some((key) => url.searchParams.has(key));
}

function buildSalesChannelsPath(search: string): string {
  return `${JUMIA_MOBILE_RETURN_PATH}${search}`;
}

export function rewriteJumiaDeepLinkPath(path: string): string {
  try {
    const url = new URL(path, JUMIA_MOBILE_RETURN_URL);

    if (url.protocol !== `${BACI_ADMIN_SCHEME}:`) {
      return path;
    }

    const routeSegments = getRouteSegments(url);
    const isSalesChannelsRoute = routeSegments.join('/') === 'sales-channels';

    if (isSalesChannelsRoute) {
      return buildSalesChannelsPath(url.search);
    }

    if (routeSegments.length === 0 && isJumiaCallbackUrl(url)) {
      return buildSalesChannelsPath(url.search);
    }

    return path;
  } catch {
    return path;
  }
}
