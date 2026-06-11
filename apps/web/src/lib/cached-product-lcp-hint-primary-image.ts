import type { CachedProductLcpHint } from '@/lib/cached-data';

export function getCachedProductLcpHintPrimaryImage(
  cachedProduct: CachedProductLcpHint | null | undefined
): string | null {
  const firstImage = cachedProduct?.images?.[0];
  const primaryImage =
    typeof firstImage === 'string' ? firstImage : (firstImage?.url ?? null);
  const normalizedImage = primaryImage?.trim();

  return normalizedImage || null;
}
