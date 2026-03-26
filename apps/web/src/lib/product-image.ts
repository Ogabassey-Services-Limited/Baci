// Both placeholders intentionally reference the same asset — a single
// placeholder image is used regardless of display size.
export const PRODUCT_IMAGE_PLACEHOLDER_URL = '/placeholder.png';

export const PRODUCT_IMAGE_LARGE_PLACEHOLDER_URL = '/placeholder.png';

/**
 * Returns true only for URLs with http or https schemes.
 * Rejects dangerous schemes like javascript:, data:, etc.
 */
function isSafeUrl(url: string): boolean {
  // Relative paths (e.g. "/images/foo.png") are safe — skip URL parsing.
  // Reject protocol-relative URLs like "//evil.com" which bypass origin checks.
  if (url.startsWith('/') && !url.startsWith('//')) return true;
  try {
    const parsed = new URL(url, 'https://placeholder.invalid');
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getPrimaryProductImage(
  images: Array<string | { url?: string | null }> | null | undefined
): string | null {
  if (!Array.isArray(images) || images.length === 0) {
    return null;
  }

  for (const image of images) {
    if (typeof image === 'string') {
      const normalized = image.trim();
      if (normalized.length > 0 && isSafeUrl(normalized)) {
        return normalized;
      }
    } else if (image && typeof image === 'object') {
      const normalized = image.url?.trim();
      if (normalized && isSafeUrl(normalized)) {
        return normalized;
      }
    }
  }

  return null;
}
