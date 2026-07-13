const MAX_VERCEL_CACHE_TAG_BYTES = 256;

interface StorefrontPublicationCacheTagInput {
  kind: 'slug' | 'hostname';
  value: string;
}

/**
 * Build the tenant-scoped response tag shared by storefront HTML and
 * publication mutation eviction. Vercel reserves commas as tag delimiters and
 * limits each tag to 256 UTF-8 bytes.
 */
export function getStorefrontPublicationCacheTag({
  kind,
  value,
}: StorefrontPublicationCacheTagInput): string | null {
  const normalizedValue = value.trim().toLowerCase();
  if (!normalizedValue || normalizedValue.includes(',')) {
    return null;
  }

  const prefix = kind === 'slug' ? 'ps' : 'ph';
  const tag = `${prefix}:${normalizedValue}`;
  return new TextEncoder().encode(tag).byteLength <= MAX_VERCEL_CACHE_TAG_BYTES
    ? tag
    : null;
}
