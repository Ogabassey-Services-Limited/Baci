import { createHash } from 'node:crypto';

const MAX_TAG_PART_LENGTH = 48;
const CACHE_TAG_HASH_LENGTH = 32;

function normalizeCacheTagPart(value: string): string {
  return value.trim().toLowerCase();
}

function toReadableTagPart(value: string): string {
  const readable = value.replace(/[^a-z0-9.-]+/g, '-').replace(/^-+|-+$/g, '');
  return (readable || 'empty').slice(0, MAX_TAG_PART_LENGTH);
}

export function getBlogCacheTag(
  routeIdentifier: string,
  postSlug: string
): string {
  const normalizedIdentifier = normalizeCacheTagPart(routeIdentifier);
  const normalizedPostSlug = normalizeCacheTagPart(postSlug);
  const digest = createHash('sha256')
    .update(`${normalizedIdentifier}\0${normalizedPostSlug}`)
    .digest('hex')
    .slice(0, CACHE_TAG_HASH_LENGTH);

  return `blog-${toReadableTagPart(normalizedIdentifier)}-${toReadableTagPart(
    normalizedPostSlug
  )}-${digest}`;
}
