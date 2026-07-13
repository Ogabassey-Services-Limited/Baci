import { getMerchantSlugCacheTag } from '@/lib/merchant-slug-cache-tag';
import { resolvePurgeHostnames } from '@/lib/storefront-purge-shared';

const SAFE_MERCHANT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_CACHE_TAG_BYTES = 256;

function addCacheTagWithinLimit(tags: Set<string>, tag: string): void {
  if (new TextEncoder().encode(tag).byteLength <= MAX_CACHE_TAG_BYTES) {
    tags.add(tag);
  }
}

interface MerchantPublicationDataCacheTagsInput {
  canonicalMerchantSlug: string | null | undefined;
  identifiers: readonly (string | null | undefined)[];
  merchantId: string;
}

/**
 * Build the exact publication-sensitive Next/Vercel Data Cache tag set. This
 * is shared by normal Next revalidation and foreground Vercel deletion so the
 * two paths cannot drift.
 */
export function buildMerchantPublicationDataCacheTags({
  canonicalMerchantSlug,
  identifiers,
  merchantId,
}: MerchantPublicationDataCacheTagsInput): string[] {
  const normalizedMerchantId = merchantId.trim();
  if (!normalizedMerchantId) {
    return [];
  }

  const normalizedIdentifiers = new Set(
    identifiers
      .map((identifier) => identifier?.trim().toLowerCase())
      .filter((identifier): identifier is string => Boolean(identifier))
  );
  const normalizedCanonicalSlug =
    canonicalMerchantSlug?.trim().toLowerCase() ?? '';
  if (SAFE_MERCHANT_SLUG_PATTERN.test(normalizedCanonicalSlug)) {
    normalizedIdentifiers.add(normalizedCanonicalSlug);
  }
  for (const identifier of Array.from(normalizedIdentifiers)) {
    for (const hostname of resolvePurgeHostnames(identifier)) {
      normalizedIdentifiers.add(hostname.toLowerCase());
    }
  }

  const tags = new Set<string>();
  addCacheTagWithinLimit(tags, `merchant-id-${normalizedMerchantId}`);
  addCacheTagWithinLimit(tags, `features-${normalizedMerchantId}`);
  for (const identifier of normalizedIdentifiers) {
    if (SAFE_MERCHANT_SLUG_PATTERN.test(identifier)) {
      addCacheTagWithinLimit(tags, getMerchantSlugCacheTag(identifier));
    }
    addCacheTagWithinLimit(tags, `merchant-${identifier}`);
    addCacheTagWithinLimit(tags, `domain-${identifier}`);
  }
  return Array.from(tags);
}
