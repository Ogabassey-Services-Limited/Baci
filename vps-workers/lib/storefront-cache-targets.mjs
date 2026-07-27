import { createHash } from 'node:crypto';

const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_TAG = /^[A-Za-z0-9._-]+$/;
const SAFE_HOSTNAME =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function productTag(scope, merchantId, productSlug) {
  const raw = `${scope}-${merchantId}-${productSlug}`;
  if (raw.length <= 256 && SAFE_TAG.test(raw)) return raw;
  const normalize = (value) => value.trim().toLowerCase();
  const readable = (value) =>
    normalize(value)
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'empty';
  const digest = createHash('sha256')
    .update(
      `${normalize(scope)}\0${normalize(merchantId)}\0${normalize(productSlug)}`
    )
    .digest('hex')
    .slice(0, 32);
  return `${readable(scope)}-${readable(merchantId)}-${readable(productSlug)}-${digest}`;
}

function addTag(tags, tag) {
  const hasInvalidCharacter = [...tag].some((character) => {
    const codePoint = character.codePointAt(0);
    return (
      character === ',' ||
      codePoint === undefined ||
      codePoint < 32 ||
      codePoint === 127
    );
  });
  if (Buffer.byteLength(tag, 'utf8') <= 256 && !hasInvalidCharacter)
    tags.add(tag);
}

function addHostname(values, value) {
  const normalized = value.trim().toLowerCase();
  if (!SAFE_HOSTNAME.test(normalized)) return;
  values.add(normalized);
}

function addDomainAliases(values, value) {
  const normalized = value.trim().toLowerCase();
  if (!SAFE_HOSTNAME.test(normalized)) return;
  addHostname(values, normalized);
  addHostname(
    values,
    normalized.startsWith('www.')
      ? normalized.slice('www.'.length)
      : `www.${normalized}`
  );
}

export function buildStorefrontCacheTargets(claim, rootDomain) {
  const merchantId = claim.merchant_id.trim().toLowerCase();
  const identifiers = new Set(
    [...claim.related_identifiers, claim.target_id]
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
  const slugs = new Set(
    [...identifiers].filter((value) => SAFE_SLUG.test(value))
  );
  const hostnames = new Set();
  for (const identifier of identifiers) addDomainAliases(hostnames, identifier);
  if (claim.target_kind === 'storefront_slug') {
    addHostname(
      hostnames,
      `${claim.target_id.trim().toLowerCase()}.${rootDomain}`
    );
  }

  const tags = new Set();
  for (const tag of [
    `merchant-id-${merchantId}`,
    `features-${merchantId}`,
    `products-${merchantId}`,
    `storefront-products-${merchantId}`,
    `categories-${merchantId}`,
    `category-page-data-${merchantId}`,
    `product-index-${merchantId}`,
    `product-slug-set-${merchantId}`,
    `merchant-feed-${merchantId}`,
    `dashboard-${merchantId}`,
    'navigation-categories',
    'product-details',
    'product-canonical-redirect',
    'product-legacy-redirect',
    'product-lcp-image',
  ])
    addTag(tags, tag);
  for (const identifier of identifiers) {
    addTag(tags, `merchant-${identifier}`);
    addTag(tags, `domain-${identifier}`);
  }
  for (const slug of slugs) {
    addTag(tags, `merchant-slug-${slug}`);
    addTag(tags, `ps:${slug}`);
  }
  for (const hostname of hostnames) addTag(tags, `ph:${hostname}`);
  for (const slug of claim.product_slugs) {
    addTag(tags, productTag('product', merchantId, slug));
    addTag(tags, productTag('product-lcp-image', merchantId, slug));
  }
  return { hostnames: [...hostnames], tags: [...tags] };
}
