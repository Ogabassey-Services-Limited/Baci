import {
  isAllowedBnplPopupUrl,
  isTrustedBNPLMerchantDomainHost,
} from '@/lib/bnpl-url';

export const BNPL_DOCUMENT_ACCEPT_HEADER =
  'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

const NEXT_DATA_QUERY_PARAMS = new Set(['_rsc', '_nocache']);
const BNPL_MERCHANT_CONTEXT_QUERY_PARAMS = new Set(['merchant_slug', 'slug']);

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
  merchantSlug?: string,
  merchantDomain?: string
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

    if (requestUrl.protocol === 'https:') {
      const requestHost = requestUrl.hostname.toLowerCase();
      if (
        isTrustedBNPLMerchantDomainHost(requestHost, merchantDomain) ||
        isTrustedBNPLMerchantDomainHost(requestHost, merchantSlug)
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

    const isBnplPathA = pathA === 'checkout/bnpl';
    const isBnplPathB = pathB === 'checkout/bnpl';

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

    const getMerchantContextParam = (params: URLSearchParams) =>
      (params.get('merchant_slug') || params.get('slug'))?.trim().toLowerCase();
    const expectedMerchantSlug = merchantSlug?.trim().toLowerCase();
    const merchantContextA = getMerchantContextParam(parsedA.searchParams);
    const merchantContextB = getMerchantContextParam(parsedB.searchParams);
    const merchantContextValues = [merchantContextA, merchantContextB].filter(
      Boolean
    );

    if (expectedMerchantSlug) {
      if (
        merchantContextValues.some(
          (context) => context !== expectedMerchantSlug
        )
      ) {
        return false;
      }
    } else if (merchantContextA !== merchantContextB) {
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
  merchantDomain,
}: {
  apiBaseUrl: string;
  currentDocumentUrl: string;
  isTopFrame?: boolean;
  requestUrl: string;
  merchantSlug?: string;
  merchantDomain?: string;
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
    merchantSlug,
    merchantDomain
  );
  if (isTopFrame === true && !isAllowedCheckoutUrl) {
    return {
      nextUrl,
      reason: 'untrusted' as const,
      shouldStart: false,
    };
  }

  if (
    !isBaciDocumentNavigation(nextUrl, apiBaseUrl, merchantSlug, merchantDomain)
  ) {
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
