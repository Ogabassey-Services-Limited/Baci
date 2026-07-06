interface StorefrontPathPrefixHeaders {
  get(name: string): string | null;
}

interface StorefrontPathPrefixMerchant {
  custom_domain?: string | null;
  slug: string;
}

function normalizeHeaderValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

function normalizeCustomDomainValue(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const withoutScheme = trimmed.replace(/^https?:\/\//i, '');
  const hostname = withoutScheme.split('/')[0]?.trim().toLowerCase();

  return hostname || null;
}

function normalizeHostnameValue(value: string | null | undefined) {
  const normalized = normalizeCustomDomainValue(value);

  return normalized?.split(':')[0] || null;
}

function stripWwwPrefix(hostname: string | null) {
  return hostname?.replace(/^www\./, '') || null;
}

export function getStorefrontPathPrefix(
  headersList: StorefrontPathPrefixHeaders,
  merchant: StorefrontPathPrefixMerchant | string
) {
  const merchantSlug = typeof merchant === 'string' ? merchant : merchant.slug;
  const merchantCustomDomain = stripWwwPrefix(
    typeof merchant === 'string'
      ? null
      : normalizeHostnameValue(merchant.custom_domain)
  );
  const normalizedMerchantSlug = normalizeHeaderValue(merchantSlug);
  const requestHost = normalizeHostnameValue(
    headersList.get('x-forwarded-host') ?? headersList.get('host')
  );
  const requestHostApex = stripWwwPrefix(requestHost);
  const requestMerchantSlug = normalizeHeaderValue(
    headersList.get('x-merchant-slug')
  );
  const requestCustomDomain = stripWwwPrefix(
    normalizeHostnameValue(headersList.get('x-custom-domain'))
  );
  const servedAtSubdomainRoot =
    requestHost !== null &&
    normalizedMerchantSlug !== null &&
    requestMerchantSlug === normalizedMerchantSlug &&
    requestHost.startsWith(`${normalizedMerchantSlug}.`);
  const servedAtCustomDomainRoot =
    requestHostApex !== null &&
    merchantCustomDomain !== null &&
    requestCustomDomain === merchantCustomDomain &&
    requestHostApex === merchantCustomDomain;
  const servedAtDomainRoot = servedAtSubdomainRoot || servedAtCustomDomainRoot;

  return servedAtDomainRoot ? '' : `/${merchantSlug}`;
}

export function resolveStorefrontPathHref(pathPrefix: string, href: string) {
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return href;
  }

  const normalizedPathPrefix = pathPrefix.replace(/\/+$/g, '');

  if (href === '/') {
    return normalizedPathPrefix || '/';
  }

  const normalizedHref = `/${href.replace(/^\/+/, '')}`;

  if (
    normalizedPathPrefix &&
    (normalizedHref === normalizedPathPrefix ||
      normalizedHref.startsWith(`${normalizedPathPrefix}/`))
  ) {
    return normalizedHref;
  }

  return `${normalizedPathPrefix}${normalizedHref}`;
}
