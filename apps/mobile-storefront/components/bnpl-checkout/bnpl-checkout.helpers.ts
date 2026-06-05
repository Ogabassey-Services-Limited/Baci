import { BNPLParamsSchema } from '@/components/bnpl-checkout/bnpl-params.schema';
import {
  type BNPLRouteParams,
  buildKlumpAuthorizationUrl,
} from '@/lib/bnpl-url';

export const BNPL_LOAD_TIMEOUT_MS = 45_000;
export const BNPL_LOAD_TIMEOUT_MESSAGE =
  'Payment page is taking longer than expected. Check your connection and try again.';
export const BNPL_UNTRUSTED_POPUP_MESSAGE =
  'Payment provider opened an untrusted checkout window.';

export {
  areBNPLCheckoutUrlsEquivalent,
  BNPL_DOCUMENT_ACCEPT_HEADER,
  buildBNPLDocumentSource,
  isBNPLCheckoutExitUrl,
  resolveBNPLDocumentNavigation,
  sanitizeBNPLDocumentUrl,
} from './bnpl-checkout-navigation';

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

export function getBNPLDebugUrlDetails(targetUrl?: string) {
  const rawUrl = targetUrl || '';
  if (!rawUrl) {
    return {
      parsed: false,
      rawUrl,
      reason: 'empty',
    };
  }

  try {
    const parsedUrl = new URL(rawUrl);
    const searchKeys = Array.from(new Set(parsedUrl.searchParams.keys()));

    return {
      hasHash: parsedUrl.hash.length > 0,
      hasSearch: parsedUrl.search.length > 0,
      hostname: parsedUrl.hostname,
      origin: parsedUrl.origin,
      parsed: true,
      pathname: parsedUrl.pathname,
      protocol: parsedUrl.protocol,
      rawUrl,
      searchKeys,
    };
  } catch {
    return {
      parsed: false,
      rawUrl,
      reason: 'invalid-url',
    };
  }
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
    amount,
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
  if (amount?.trim()) query.set('amount', amount.trim());
  if (trackingToken?.trim()) query.set('token', trackingToken.trim());

  return `${baseUrl}/${slug}/checkout/bnpl?${query.toString()}`;
}

export const BNPL_INJECTED_JAVASCRIPT = `
  (function() {
    const postDebugMessage = function(payload) {
      try {
        window.ReactNativeWebView?.postMessage(JSON.stringify(payload));
      } catch (_error) {
        // Ignore diagnostics failures so checkout scripts keep running.
      }
    };

    const providerHostnames = [
      'useklump.com',
      'creditdirect.ng',
      'credpal.com',
      'lendastack.io',
      'mono.co',
      'paystack.com',
      'paystack.co'
    ];

    const isProviderOrigin = function(origin) {
      if (typeof origin !== 'string') return false;

      try {
        const parsedOrigin = new URL(origin);
        return providerHostnames.some(function(hostname) {
          return parsedOrigin.hostname === hostname || parsedOrigin.hostname.endsWith('.' + hostname);
        });
      } catch (_error) {
        return false;
      }
    };

    const getMessageSummary = function(data) {
      if (!data || typeof data !== 'object') {
        return { payloadType: typeof data };
      }

      const summary = { payloadType: 'object' };
      ['type', 'status', 'name', 'gateway'].forEach(function(key) {
        if (typeof data[key] === 'string') summary[key] = data[key];
      });

      if (data.data && typeof data.data === 'object') {
        ['type', 'status', 'name', 'gateway'].forEach(function(key) {
          if (typeof data.data[key] === 'string') summary[key] = data.data[key];
        });
      }

      return summary;
    };

    const getUrlDebugDetails = function(rawUrl) {
      const stringUrl = rawUrl ? String(rawUrl) : '';
      if (!stringUrl) {
        return {
          parsed: false,
          rawUrl: '',
          reason: 'empty'
        };
      }

      try {
        const parsedUrl = new URL(stringUrl, window.location.href);
        const searchKeysSet = new Set();
        parsedUrl.searchParams.forEach(function(_value, key) {
          searchKeysSet.add(key);
        });

        return {
          hasHash: parsedUrl.hash.length > 0,
          hasSearch: parsedUrl.search.length > 0,
          hostname: parsedUrl.hostname,
          origin: parsedUrl.origin,
          parsed: true,
          pathname: parsedUrl.pathname,
          protocol: parsedUrl.protocol,
          rawUrl: stringUrl,
          searchKeys: Array.from(searchKeysSet)
        };
      } catch (_error) {
        return {
          parsed: false,
          rawUrl: stringUrl,
          reason: 'invalid-url'
        };
      }
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

    if (typeof window.open === 'function') {
      const originalOpen = window.open;
      window.open = function(url, target, features) {
        postDebugMessage({
          type: 'bnpl_log',
          message: 'window.open called',
          target: getUrlDebugDetails(url),
          windowTarget: target ? String(target) : '',
          features: typeof features === 'string' ? features : '',
          url: window.location.href
        });

        return originalOpen.apply(this, arguments);
      };
    }

    window.addEventListener('error', function(event) {
      const target = event.target;
      if (target && target !== window) {
        const source = target.src || target.href || '';
        if (source) {
          postDebugMessage({
            type: 'bnpl_error_log',
            message: 'WebView resource failed to load',
            source: source,
            url: window.location.href
          });
        }
        return;
      }

      postDebugMessage({
        type: 'bnpl_error_log',
        message: event.message || 'Unhandled WebView error',
        source: event.filename || window.location.href,
        line: String(event.lineno || ''),
        column: String(event.colno || '')
      });
    }, true);

    window.addEventListener('unhandledrejection', function(event) {
      const reason = event.reason;
      postDebugMessage({
        type: 'bnpl_error_log',
        message: reason instanceof Error ? reason.message : String(reason || 'Unhandled WebView rejection'),
        source: window.location.href
      });
    });

    const allowedMessageTypes = new Set(['checkoutStatus', 'paymentResult', 'bnpl_log', 'bnpl_error_log', 'bnpl_close', 'navigation']);
    window.addEventListener('message', function(event) {
      if (isProviderOrigin(event.origin)) {
        postDebugMessage({
          type: 'bnpl_log',
          message: 'Provider postMessage received',
          source: event.origin,
          summary: getMessageSummary(event.data),
          url: window.location.href
        });
      }

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
      postDebugMessage({
        type: 'navigation',
        url: window.location.href
      });
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function() {
      originalReplaceState.apply(history, arguments);
      postDebugMessage({
        type: 'navigation',
        url: window.location.href
      });
    };

    window.addEventListener('hashchange', function() {
      postDebugMessage({
        type: 'navigation',
        url: window.location.href
      });
    });
  })();
  true;
`;
