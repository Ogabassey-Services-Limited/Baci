import {
  normalizeStorefrontCategorySlug,
  STOREFRONT_CATEGORY_ALIASES,
} from '@/lib/normalize-storefront-category-slug';

const PLATFORM_HOST = 'usebaci.com';

const TRACKING_PARAM_NAMES = new Set([
  'fbclid',
  'gclid',
  'gclsrc',
  'dclid',
  'msclkid',
  'srsltid',
]);

// Canonical top-level storefront segments the link normalizer recognises as
// "already internal" (so it leaves them alone / collapses legacy merchant
// prefixes). Derived from the shared alias table so adding a new alias key
// automatically participates in this check without having to touch this file.
const INTERNAL_STOREFRONT_SEGMENTS = new Set<string>([
  'products',
  'blog',
  'category',
  'product-category',
  // Canonical values
  ...Object.values(STOREFRONT_CATEGORY_ALIASES),
  // Legacy keys (so `/phones/...` is still detected as internal before being
  // rewritten to its canonical form further down).
  ...Object.keys(STOREFRONT_CATEGORY_ALIASES),
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const INTERNAL_STOREFRONT_PREFIX = new RegExp(
  `^/(?:${Array.from(INTERNAL_STOREFRONT_SEGMENTS).map(escapeRegExp).join('|')})(?:/|$)`
);

export interface NormalizeStorefrontContentHrefOptions {
  basePath?: string;
  baseUrl?: string;
  merchantSlug?: string;
}

function normalizeBasePath(basePath = ''): string {
  if (!basePath || basePath === '/') {
    return '';
  }

  const normalized = basePath.startsWith('/') ? basePath : `/${basePath}`;
  return normalized.replace(/\/+$/, '');
}

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '');
}

function lowercasePathPreservingPercentEncoding(pathname: string): string {
  let result = '';

  for (let index = 0; index < pathname.length; index++) {
    const char = pathname[index];
    const firstHex = pathname[index + 1];
    const secondHex = pathname[index + 2];

    if (
      char === '%' &&
      firstHex &&
      secondHex &&
      /^[0-9a-fA-F]$/.test(firstHex) &&
      /^[0-9a-fA-F]$/.test(secondHex)
    ) {
      result += `${char}${firstHex}${secondHex}`;
      index += 2;
      continue;
    }

    result += char.toLowerCase();
  }

  return result;
}

function getMerchantIdentifier(
  basePath = '',
  baseUrl = '',
  merchantSlug?: string
): string | null {
  if (merchantSlug) {
    return merchantSlug.toLowerCase();
  }

  const normalizedBasePath = normalizeBasePath(basePath);
  if (normalizedBasePath) {
    return normalizedBasePath.split('/')[1] || null;
  }

  if (!baseUrl) {
    return null;
  }

  try {
    const host = normalizeHost(new URL(baseUrl).hostname);
    if (host.endsWith(`.${PLATFORM_HOST}`)) {
      return host.slice(0, -(PLATFORM_HOST.length + 1)) || null;
    }

    return null;
  } catch {
    return null;
  }
}

function stripTrackingParams(searchParams: URLSearchParams) {
  for (const key of Array.from(searchParams.keys())) {
    if (TRACKING_PARAM_NAMES.has(key) || key.startsWith('utm_')) {
      searchParams.delete(key);
    }
  }
}

function collapseLegacyMerchantPrefix(
  pathname: string,
  merchantIdentifier: string | null
): string {
  if (!merchantIdentifier) {
    return pathname;
  }

  const prefix = `/${merchantIdentifier}`;

  if (pathname === prefix || pathname === `${prefix}/`) {
    return '/';
  }

  if (!pathname.startsWith(`${prefix}/`)) {
    return pathname;
  }

  const remainder = pathname.slice(prefix.length) || '/';
  return INTERNAL_STOREFRONT_PREFIX.test(remainder) ? remainder : pathname;
}

function normalizeInternalStorefrontPath(
  pathname: string,
  merchantIdentifier: string | null
): string {
  let normalizedPath = lowercasePathPreservingPercentEncoding(pathname || '/');

  if (!normalizedPath.startsWith('/')) {
    normalizedPath = `/${normalizedPath}`;
  }

  normalizedPath = normalizedPath.replace(/\/{2,}/g, '/');
  normalizedPath =
    normalizedPath === '/' ? '/' : normalizedPath.replace(/\/+$/, '');
  normalizedPath = collapseLegacyMerchantPrefix(
    normalizedPath,
    merchantIdentifier
  );

  if (normalizedPath === '/phones' || normalizedPath.startsWith('/phones/')) {
    normalizedPath = `/smartphones${normalizedPath.slice('/phones'.length)}`;
  }

  if (normalizedPath === '/phone' || normalizedPath.startsWith('/phone/')) {
    normalizedPath = `/smartphones${normalizedPath.slice('/phone'.length)}`;
  }

  if (normalizedPath === '/samsung' || normalizedPath.startsWith('/samsung/')) {
    normalizedPath = `/smartphones${normalizedPath.slice('/samsung'.length)}`;
  }

  if (normalizedPath === '/laptop' || normalizedPath.startsWith('/laptop/')) {
    normalizedPath = `/laptops${normalizedPath.slice('/laptop'.length)}`;
  }

  if (normalizedPath === '/macbook' || normalizedPath.startsWith('/macbook/')) {
    normalizedPath = `/laptops${normalizedPath.slice('/macbook'.length)}`;
  }

  if (
    normalizedPath === '/product-category' ||
    normalizedPath.startsWith('/product-category/')
  ) {
    const categorySlug = normalizedPath
      .slice('/product-category/'.length)
      .replace(/^\/+|\/+$/g, '');

    if (!categorySlug) {
      return '/products';
    }

    const [normalizedCategorySlug, ...rest] = categorySlug
      .split('/')
      .filter(Boolean);
    const canonicalCategorySlug =
      normalizeStorefrontCategorySlug(normalizedCategorySlug) ||
      normalizedCategorySlug;
    const categoryPath = `/${canonicalCategorySlug}`;

    return rest.length ? `${categoryPath}/${rest.join('/')}` : categoryPath;
  }

  if (
    normalizedPath === '/category' ||
    normalizedPath.startsWith('/category/')
  ) {
    const remainder = normalizedPath
      .slice('/category/'.length)
      .replace(/^\/+|\/+$/g, '');

    if (!remainder || remainder.startsWith('product/')) {
      return '/products';
    }

    const [categorySlug, ...rest] = remainder.split('/');
    const normalizedCategorySlug =
      normalizeStorefrontCategorySlug(categorySlug) || categorySlug;
    return rest.length
      ? `/${normalizedCategorySlug}/${rest.join('/')}`
      : `/${normalizedCategorySlug}`;
  }

  if (
    normalizedPath === '/accesories' ||
    normalizedPath.startsWith('/accesories/')
  ) {
    normalizedPath = `/accessories${normalizedPath.slice('/accesories'.length)}`;
  }

  return normalizedPath || '/';
}

function prependBasePath(pathname: string, basePath = ''): string {
  const normalizedBasePath = normalizeBasePath(basePath);

  if (!normalizedBasePath) {
    return pathname || '/';
  }

  if (pathname === '/') {
    return normalizedBasePath;
  }

  if (
    pathname === normalizedBasePath ||
    pathname.startsWith(`${normalizedBasePath}/`)
  ) {
    return pathname;
  }

  return `${normalizedBasePath}${pathname}`;
}

function buildNormalizedInternalHref(
  pathname: string,
  searchParams: URLSearchParams,
  hash: string,
  merchantIdentifier: string | null,
  basePath = ''
): string {
  const normalizedPath = prependBasePath(
    normalizeInternalStorefrontPath(pathname, merchantIdentifier),
    basePath
  );
  const normalizedSearch = searchParams.toString();

  return `${normalizedPath}${normalizedSearch ? `?${normalizedSearch}` : ''}${hash}`;
}

function normalizeRootRelativeStorefrontHref(
  href: string,
  merchantIdentifier: string | null,
  basePath = ''
): string {
  try {
    const parsedHref = new URL(href, 'https://storefront.invalid');
    stripTrackingParams(parsedHref.searchParams);

    return buildNormalizedInternalHref(
      parsedHref.pathname,
      parsedHref.searchParams,
      parsedHref.hash,
      merchantIdentifier,
      basePath
    );
  } catch {
    return prependBasePath(
      normalizeInternalStorefrontPath(href, merchantIdentifier),
      basePath
    );
  }
}

function isStorefrontPlatformPath(
  pathname: string,
  merchantIdentifier: string | null
): boolean {
  const loweredPath = lowercasePathPreservingPercentEncoding(pathname || '/');

  if (!merchantIdentifier) {
    return INTERNAL_STOREFRONT_PREFIX.test(loweredPath);
  }

  return (
    loweredPath === `/${merchantIdentifier}` ||
    loweredPath.startsWith(`/${merchantIdentifier}/`) ||
    INTERNAL_STOREFRONT_PREFIX.test(loweredPath)
  );
}

function isLikelyMerchantCustomDomain(
  hostname: string,
  merchantIdentifier: string
): boolean {
  const labels = hostname.split('.');
  const multipartTlds = new Set(['com.ng', 'org.ng', 'net.ng', 'name.ng']);
  const lastTwoLabels = labels.slice(-2).join('.');
  const tldLabelCount = multipartTlds.has(lastTwoLabels) ? 2 : 1;
  const merchantLabelIndex = labels.length - (tldLabelCount + 1);

  if (merchantLabelIndex < 0) {
    return false;
  }

  const extraLabels = labels.slice(0, merchantLabelIndex);
  if (extraLabels.length > 0) {
    return extraLabels.length === 1 && extraLabels[0] === 'www'
      ? labels[merchantLabelIndex] === merchantIdentifier
      : false;
  }

  return labels[merchantLabelIndex] === merchantIdentifier;
}

function isInternalStorefrontAbsoluteUrl(
  href: URL,
  options: NormalizeStorefrontContentHrefOptions,
  merchantIdentifier: string | null
): boolean {
  const normalizedHrefHost = normalizeHost(href.hostname);

  if (options.baseUrl) {
    try {
      const currentHost = normalizeHost(new URL(options.baseUrl).hostname);
      if (normalizedHrefHost === currentHost) {
        return true;
      }
    } catch {
      // Ignore invalid baseUrl and continue with merchant heuristics.
    }
  }

  if (!merchantIdentifier) {
    return normalizedHrefHost === PLATFORM_HOST;
  }

  if (normalizedHrefHost === `${merchantIdentifier}.${PLATFORM_HOST}`) {
    return true;
  }

  if (normalizedHrefHost === PLATFORM_HOST) {
    return isStorefrontPlatformPath(href.pathname, merchantIdentifier);
  }

  return isLikelyMerchantCustomDomain(normalizedHrefHost, merchantIdentifier);
}

export function normalizeStorefrontContentHref(
  rawHref: string,
  options: NormalizeStorefrontContentHrefOptions = {}
): string {
  const trimmedHref = rawHref.trim();
  const normalizedHref = trimmedHref.toLowerCase();

  if (
    !trimmedHref ||
    trimmedHref.startsWith('#') ||
    trimmedHref.startsWith('mailto:') ||
    trimmedHref.startsWith('tel:') ||
    trimmedHref.startsWith('//')
  ) {
    return trimmedHref;
  }

  if (
    normalizedHref.startsWith('javascript:') ||
    normalizedHref.startsWith('data:') ||
    normalizedHref.startsWith('vbscript:')
  ) {
    return '#';
  }

  const merchantIdentifier = getMerchantIdentifier(
    options.basePath,
    options.baseUrl,
    options.merchantSlug
  );

  if (trimmedHref.startsWith('/')) {
    return normalizeRootRelativeStorefrontHref(
      trimmedHref,
      merchantIdentifier,
      options.basePath
    );
  }

  try {
    const parsedHref = new URL(trimmedHref);

    if (
      !isInternalStorefrontAbsoluteUrl(parsedHref, options, merchantIdentifier)
    ) {
      return trimmedHref;
    }

    stripTrackingParams(parsedHref.searchParams);
    return buildNormalizedInternalHref(
      parsedHref.pathname,
      parsedHref.searchParams,
      parsedHref.hash,
      merchantIdentifier,
      options.basePath
    );
  } catch {
    return trimmedHref;
  }
}
