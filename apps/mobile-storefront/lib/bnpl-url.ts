export type BNPLRouteParams = Record<string, string | string[]>;

const USEBACI_HOSTNAME = 'usebaci.com';
const BNPL_PROVIDER_POPUP_ORIGINS = new Set([
  'https://api.credpal.com',
  'https://app.creditdirect.ng',
  'https://cdl.test.lendastack.io',
  'https://checkout.creditdirect.ng',
  'https://checkout.credpal.com',
  'https://corporate-loans.obs.sa-brazil-1.myhuaweicloud.com',
]);

function getFirstRouteParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function normalizeBNPLRouteParams(params: BNPLRouteParams) {
  return Object.fromEntries(
    Object.entries(params).flatMap(([key, value]) => {
      const normalizedValue = getFirstRouteParam(value);
      return typeof normalizedValue === 'string'
        ? [[key, normalizedValue]]
        : [];
    })
  );
}

export function getTrustedAuthorizationUrl(
  authorizationUrl: string | undefined,
  baseUrl: string,
  fallbackUrl: string
) {
  const fallback = new URL(fallbackUrl);
  const candidate = authorizationUrl?.trim();
  if (!candidate) {
    return fallback;
  }

  try {
    const trustedBase = new URL(baseUrl);
    const parsedUrl = new URL(candidate, trustedBase);
    if (
      !['http:', 'https:'].includes(parsedUrl.protocol) ||
      parsedUrl.origin !== trustedBase.origin
    ) {
      return fallback;
    }

    return parsedUrl;
  } catch {
    return fallback;
  }
}

export function getAuthorizationSearchParams(
  authorizationUrl: string | undefined,
  baseUrl: string
) {
  const candidate = authorizationUrl?.trim();
  if (!candidate) {
    return null;
  }

  try {
    const trustedBase = new URL(baseUrl);
    const parsedUrl = new URL(candidate, trustedBase);
    if (
      !['http:', 'https:'].includes(parsedUrl.protocol) ||
      parsedUrl.origin !== trustedBase.origin
    ) {
      return null;
    }

    return parsedUrl.searchParams;
  } catch {
    return null;
  }
}

export function buildKlumpAuthorizationUrl({
  authorizationUrl,
  baseUrl,
  customerEmail,
  customerName,
  customerPhone,
  orderId,
  reference,
  slug,
  trackingToken,
}: {
  authorizationUrl?: string;
  baseUrl: string;
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  orderId: string;
  reference?: string;
  slug: string;
  trackingToken?: string;
}) {
  const fallbackUrl = `${baseUrl}/${slug}/checkout/bnpl`;
  const parsedUrl = getTrustedAuthorizationUrl(
    authorizationUrl,
    baseUrl,
    fallbackUrl
  );
  const authorizationSearchParams = getAuthorizationSearchParams(
    authorizationUrl,
    baseUrl
  );
  const klumpReference =
    reference?.trim() || authorizationSearchParams?.get('reference')?.trim();
  const klumpTrackingToken =
    trackingToken?.trim() ||
    authorizationSearchParams?.get('trackingToken')?.trim() ||
    authorizationSearchParams?.get('token')?.trim();
  const klumpEmail =
    customerEmail?.trim() || authorizationSearchParams?.get('email')?.trim();
  const klumpCustomerName =
    customerName?.trim() ||
    authorizationSearchParams?.get('customerName')?.trim();
  const klumpCustomerPhone =
    customerPhone?.trim() ||
    authorizationSearchParams?.get('customerPhone')?.trim() ||
    authorizationSearchParams?.get('phone')?.trim();

  parsedUrl.searchParams.set('gateway', 'klump');
  parsedUrl.searchParams.set('merchant_slug', slug);
  parsedUrl.searchParams.set('orderId', orderId);

  if (klumpReference) {
    parsedUrl.searchParams.set('reference', klumpReference);
  }
  if (klumpTrackingToken) {
    parsedUrl.searchParams.set('trackingToken', klumpTrackingToken);
  }
  if (klumpEmail) {
    parsedUrl.searchParams.set('email', klumpEmail);
  }
  if (klumpCustomerName) {
    parsedUrl.searchParams.set('customerName', klumpCustomerName);
  }
  if (klumpCustomerPhone) {
    parsedUrl.searchParams.set('customerPhone', klumpCustomerPhone);
  }

  return parsedUrl.toString();
}

function isBaciReturnOrigin(targetUrl: URL, baseUrl: string) {
  try {
    const base = new URL(baseUrl);

    if (targetUrl.origin === base.origin) {
      return true;
    }

    if (
      base.hostname === USEBACI_HOSTNAME &&
      targetUrl.protocol === base.protocol &&
      (targetUrl.hostname === USEBACI_HOSTNAME ||
        targetUrl.hostname.endsWith(`.${USEBACI_HOSTNAME}`))
    ) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

export function isAllowedBnplPopupUrl(targetUrl: string, baseUrl: string) {
  try {
    const parsedTargetUrl = new URL(targetUrl);

    if (!['https:', 'http:'].includes(parsedTargetUrl.protocol)) {
      return false;
    }

    return (
      BNPL_PROVIDER_POPUP_ORIGINS.has(parsedTargetUrl.origin) ||
      isBaciReturnOrigin(parsedTargetUrl, baseUrl)
    );
  } catch {
    return false;
  }
}
