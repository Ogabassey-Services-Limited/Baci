import { BNPLParamsSchema } from '@/components/bnpl-checkout/bnpl-params.schema';
import {
  buildKlumpAuthorizationUrl,
  isAllowedBnplPopupUrl,
  type BNPLRouteParams,
} from '@/lib/bnpl-url';

export const BNPL_LOAD_TIMEOUT_MS = 45_000;
export const BNPL_LOAD_TIMEOUT_MESSAGE =
  'Payment page is taking longer than expected. Check your connection and try again.';
export const BNPL_UNTRUSTED_POPUP_MESSAGE =
  'Payment provider opened an untrusted checkout window.';
export const BNPL_DOCUMENT_ACCEPT_HEADER =
  'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

const NEXT_DATA_QUERY_PARAMS = new Set(['_rsc', '_nocache']);
const BNPL_MERCHANT_CONTEXT_QUERY_PARAMS = new Set(['merchant_slug', 'slug']);

export function parseBNPLParams(params: BNPLRouteParams) {
  const result = BNPLParamsSchema.safeParse(params);
  if (!result.success) {
    return {
      data: null,
      error: result.error.issues[0]?.message || 'Invalid parameters',
      isValid: false,
    };
  }
  return { data: result.data, error: null, isValid: true };
}

export function getBNPLGatewayName(gateway?: string) {
  return gateway === 'credpal'
    ? 'CredPal'
    : gateway === 'credit_direct'
      ? 'Credit Direct'
      : 'Klump';
}

export function extractReferenceFromUrl(url: string) {
  try {
    const urlParams = new URL(url);
    return urlParams.searchParams.get('reference');
  } catch {
    return null;
  }
}

export function extractErrorFromUrl(url: string) {
  try {
    const urlParams = new URL(url);
    return urlParams.searchParams.get('error');
  } catch {
    return null;
  }
}

export function sanitizeBNPLDocumentUrl(url: string) {
  try {
    const documentUrl = new URL(url);
    for (const paramName of NEXT_DATA_QUERY_PARAMS) {
      documentUrl.searchParams.delete(paramName);
    }
    return documentUrl.toString();
  } catch {
    return url;
  }
}

export function buildBNPLDocumentSource(url: string) {
  return {
    headers: {
      Accept: BNPL_DOCUMENT_ACCEPT_HEADER,
    },
    uri: sanitizeBNPLDocumentUrl(url),
  };
}

function isBlankProviderPopupUrl(url: string) {
  return url === 'about:blank' || url.startsWith('about:blank#');
}

function isBaciDocumentNavigation(
  url: string,
  apiBaseUrl: string,
  merchantSlug?: string
) {
  try {
    const requestUrl = new URL(url);
    const baseUrl = new URL(apiBaseUrl);

    if (
      requestUrl.protocol === baseUrl.protocol &&
      (requestUrl.hostname === baseUrl.hostname ||
        (baseUrl.hostname === 'usebaci.com' &&
          requestUrl.hostname.endsWith('.usebaci.com')))
    ) {
      return true;
    }

    // Treat merchant custom domains as Baci document navigations
    if (merchantSlug) {
      const cleanSlug = merchantSlug.toLowerCase();
      const requestHost = requestUrl.hostname.toLowerCase();

      if (
        requestHost === cleanSlug ||
        requestHost === `www.${cleanSlug}` ||
        requestHost.endsWith(`.${cleanSlug}`) ||
        (cleanSlug === 'ogabassey' &&
          (requestHost === 'ogabassey.com' ||
            requestHost === 'www.ogabassey.com'))
      ) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

type BNPLDocumentNavigationDecision =
  | {
      nextUrl?: string;
      reason: 'allowed';
      shouldStart: true;
    }
  | {
      nextUrl: string;
      reason: 'rewrite' | 'untrusted';
      shouldStart: false;
    };

export function areBNPLCheckoutUrlsEquivalent(
  urlA: string,
  urlB: string,
  merchantSlug?: string
): boolean {
  try {
    const parsedA = new URL(urlA);
    const parsedB = new URL(urlB);

    const normalizePath = (pathname: string, slug?: string): string => {
      let path = pathname.replace(/^\/|\/$/g, '').toLowerCase();
      if (slug) {
        const slugPrefix = `${slug.toLowerCase()}/`;
        if (path.startsWith(slugPrefix)) {
          path = path.slice(slugPrefix.length);
        }
      }
      return path;
    };

    const pathA = normalizePath(parsedA.pathname, merchantSlug);
    const pathB = normalizePath(parsedB.pathname, merchantSlug);

    const isBnplPathA =
      pathA === 'checkout/bnpl' || pathA.endsWith('/checkout/bnpl');
    const isBnplPathB =
      pathB === 'checkout/bnpl' || pathB.endsWith('/checkout/bnpl');

    if (!isBnplPathA || !isBnplPathB) {
      return false;
    }

    const orderIdA = parsedA.searchParams.get('orderId')?.trim();
    const orderIdB = parsedB.searchParams.get('orderId')?.trim();
    const gatewayA = parsedA.searchParams.get('gateway')?.trim();
    const gatewayB = parsedB.searchParams.get('gateway')?.trim();
    if (!orderIdA || !orderIdB || orderIdA !== orderIdB) {
      return false;
    }
    if (!gatewayA || !gatewayB || gatewayA !== gatewayB) {
      return false;
    }

    const getComparableSearchParamEntries = (params: URLSearchParams) =>
      Array.from(params.entries())
        .filter(
          ([key]) =>
            !NEXT_DATA_QUERY_PARAMS.has(key) &&
            !BNPL_MERCHANT_CONTEXT_QUERY_PARAMS.has(key)
        )
        .sort(([keyA, valueA], [keyB, valueB]) =>
          keyA === keyB
            ? valueA.localeCompare(valueB)
            : keyA.localeCompare(keyB)
        );

    const entriesA = getComparableSearchParamEntries(parsedA.searchParams);
    const entriesB = getComparableSearchParamEntries(parsedB.searchParams);
    if (entriesA.length !== entriesB.length) return false;

    return entriesA.every(([key, value], index) => {
      const [otherKey, otherValue] = entriesB[index] || [];
      return key === otherKey && value === otherValue;
    });
  } catch {
    return false;
  }
}

export function resolveBNPLDocumentNavigation({
  apiBaseUrl,
  currentDocumentUrl,
  isTopFrame,
  requestUrl,
  merchantSlug,
}: {
  apiBaseUrl: string;
  currentDocumentUrl: string;
  isTopFrame?: boolean;
  requestUrl: string;
  merchantSlug?: string;
}): BNPLDocumentNavigationDecision {
  if (!requestUrl || isBlankProviderPopupUrl(requestUrl)) {
    return {
      reason: 'allowed' as const,
      shouldStart: true,
    };
  }

  if (isTopFrame === false) {
    return {
      reason: 'allowed' as const,
      shouldStart: true,
    };
  }

  const nextUrl = sanitizeBNPLDocumentUrl(requestUrl);
  const isAllowedCheckoutUrl = isAllowedBnplPopupUrl(
    nextUrl,
    apiBaseUrl,
    merchantSlug
  );
  if (isTopFrame === true && !isAllowedCheckoutUrl) {
    return {
      nextUrl,
      reason: 'untrusted' as const,
      shouldStart: false,
    };
  }

  if (!isBaciDocumentNavigation(nextUrl, apiBaseUrl, merchantSlug)) {
    return {
      reason: 'allowed' as const,
      shouldStart: true,
    };
  }

  if (!isAllowedCheckoutUrl) {
    return {
      nextUrl,
      reason: 'untrusted' as const,
      shouldStart: false,
    };
  }

  let hasRscParam = false;
  try {
    const parsedRequest = new URL(requestUrl);
    hasRscParam = parsedRequest.searchParams.has('_rsc');
  } catch {
    // Ignore URL parsing failures on relative/about paths
  }

  const isEquivalent =
    nextUrl === currentDocumentUrl ||
    areBNPLCheckoutUrlsEquivalent(nextUrl, currentDocumentUrl, merchantSlug);

  if (isEquivalent && !hasRscParam) {
    return {
      nextUrl,
      reason: 'allowed' as const,
      shouldStart: true,
    };
  }

  return {
    nextUrl,
    reason: 'rewrite' as const,
    shouldStart: false,
  };
}

export function buildBNPLCheckoutUrl({
  apiBaseUrl,
  params,
}: {
  apiBaseUrl: string;
  params: ReturnType<typeof parseBNPLParams>;
}) {
  if (!params.isValid || !params.data?.orderId) return '';

  const {
    authorizationUrl,
    customerEmail,
    customerName,
    customerPhone,
    gateway,
    orderId,
    reference,
    trackingToken,
  } = params.data;
  const slug = params.data.merchantSlug || 'ogabassey';
  const baseUrl = apiBaseUrl.endsWith('/')
    ? apiBaseUrl.slice(0, -1)
    : apiBaseUrl;

  if (gateway === 'klump') {
    return buildKlumpAuthorizationUrl({
      authorizationUrl,
      baseUrl,
      customerEmail,
      customerName,
      customerPhone,
      orderId,
      reference,
      slug,
      trackingToken,
    });
  }

  const query = new URLSearchParams({
    gateway: gateway || '',
    merchant_slug: slug,
    orderId,
  });

  if (customerEmail?.trim()) query.set('email', customerEmail.trim());
  if (customerName?.trim()) query.set('customerName', customerName.trim());
  if (customerPhone?.trim()) query.set('customerPhone', customerPhone.trim());
  if (trackingToken?.trim()) query.set('token', trackingToken.trim());

  return `${baseUrl}/${slug}/checkout/bnpl?${query.toString()}`;
}

export const BNPL_INJECTED_JAVASCRIPT = `
  (function() {
    const postDebugMessage = function(payload) {
      window.ReactNativeWebView?.postMessage(JSON.stringify(payload));
    };

    const originalLog = console.log;
    console.log = function(...args) {
      originalLog.apply(console, args);
      const message = args.join(' ');
      if (message.includes('Credit Direct') || message.includes('CredPal') || message.includes('Klump')) {
        postDebugMessage({
          type: 'bnpl_log',
          message: message
        });
      }
    };

    window.addEventListener('error', function(event) {
      postDebugMessage({
        type: 'bnpl_error_log',
        message: event.message || 'Unhandled WebView error',
        source: event.filename || window.location.href,
        line: String(event.lineno || ''),
        column: String(event.colno || '')
      });
    });

    window.addEventListener('unhandledrejection', function(event) {
      const reason = event.reason;
      postDebugMessage({
        type: 'bnpl_error_log',
        message: reason instanceof Error ? reason.message : String(reason || 'Unhandled WebView rejection'),
        source: window.location.href
      });
    });

    const allowedMessageTypes = new Set(['checkoutStatus', 'paymentResult', 'bnpl_log', 'bnpl_error_log', 'navigation']);
    window.addEventListener('message', function(event) {
      if (event.origin !== window.location.origin) return;
      const payload = event.data;
      if (!payload || typeof payload !== 'object' || !allowedMessageTypes.has(payload.type)) return;
      const sanitized = { type: payload.type };
      ['status', 'reference', 'orderId', 'message', 'gateway', 'url', 'source', 'line', 'column'].forEach(function(key) {
        if (typeof payload[key] === 'string') sanitized[key] = payload[key];
      });
      postDebugMessage(sanitized);
    });

    const originalPushState = history.pushState;
    history.pushState = function() {
      originalPushState.apply(history, arguments);
      window.ReactNativeWebView?.postMessage(JSON.stringify({
        type: 'navigation',
        url: window.location.href
      }));
    };
  })();
  true;
`;
