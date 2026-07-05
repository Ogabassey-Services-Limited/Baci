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

export function getStorefrontPathPrefix(
  headersList: StorefrontPathPrefixHeaders,
  merchant: StorefrontPathPrefixMerchant | string
) {
  const merchantSlug = typeof merchant === 'string' ? merchant : merchant.slug;
  const merchantCustomDomain =
    typeof merchant === 'string'
      ? null
      : normalizeCustomDomainValue(merchant.custom_domain);
  const requestMerchantSlug = normalizeHeaderValue(
    headersList.get('x-merchant-slug')
  );
  const requestCustomDomain = normalizeCustomDomainValue(
    headersList.get('x-custom-domain')
  );
  const servedAtDomainRoot =
    requestMerchantSlug === normalizeHeaderValue(merchantSlug) ||
    (merchantCustomDomain !== null &&
      requestCustomDomain === merchantCustomDomain);

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

  const normalizedHref = href.startsWith('/') ? href : `/${href}`;

  return `${normalizedPathPrefix}${normalizedHref}`;
}
