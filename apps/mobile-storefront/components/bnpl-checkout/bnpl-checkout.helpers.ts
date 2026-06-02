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
