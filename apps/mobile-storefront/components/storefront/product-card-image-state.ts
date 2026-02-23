/**
 * Product-card image state helpers.
 *
 * Keeps image fallback behavior deterministic and testable:
 * once the primary image fails, we render a local placeholder
 * instead of making another remote placeholder request.
 */

export function getProductImageSource(
  imageUrl: string | null | undefined,
  hasImageError: boolean
): { uri: string } | null {
  if (hasImageError || !imageUrl) return null;

  const normalizedUrl = imageUrl.trim();
  if (normalizedUrl.length === 0) return null;

  return { uri: normalizedUrl };
}
