import { createHash } from 'node:crypto';

const MAX_CACHE_TAG_LENGTH = 256;
const MAX_READABLE_PART_LENGTH = 48;
const CACHE_TAG_HASH_LENGTH = 32;
const SAFE_CACHE_TAG_PATTERN = /^[A-Za-z0-9._-]+$/;

function normalizeCacheTagPart(value: string): string {
  return value.trim().toLowerCase();
}

function toReadableCacheTagPart(value: string): string {
  const readable = normalizeCacheTagPart(value)
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return (readable || 'empty').slice(0, MAX_READABLE_PART_LENGTH);
}

export function getProductScopedCacheTag(
  scope: string,
  merchantId: string,
  productSlug: string
): string {
  const rawTag = `${scope}-${merchantId}-${productSlug}`;

  if (
    rawTag.length <= MAX_CACHE_TAG_LENGTH &&
    SAFE_CACHE_TAG_PATTERN.test(rawTag)
  ) {
    return rawTag;
  }

  const digest = createHash('sha256')
    .update(
      `${normalizeCacheTagPart(scope)}\0${normalizeCacheTagPart(
        merchantId
      )}\0${normalizeCacheTagPart(productSlug)}`
    )
    .digest('hex')
    .slice(0, CACHE_TAG_HASH_LENGTH);

  return `${toReadableCacheTagPart(scope)}-${toReadableCacheTagPart(
    merchantId
  )}-${toReadableCacheTagPart(productSlug)}-${digest}`;
}
