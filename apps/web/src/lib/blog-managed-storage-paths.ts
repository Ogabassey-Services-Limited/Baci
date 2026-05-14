export const BLOG_FEATURED_VARIANT_KEYS = [
  'landscape_16x9',
  'standard_4x3',
  'square_1x1',
] as const;

export type BlogFeaturedVariantKey =
  (typeof BLOG_FEATURED_VARIANT_KEYS)[number];

const BLOG_FEATURED_VARIANT_FILENAME = new RegExp(
  `^(${BLOG_FEATURED_VARIANT_KEYS.map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\.webp$`
);

export function isManagedBlogStoragePath(
  path: string,
  merchantId: string
): boolean {
  if (
    !path ||
    path.includes('..') ||
    path.includes('//') ||
    path.startsWith('/')
  ) {
    return false;
  }

  const segments = path.split('/');
  if (segments.length < 3 || segments.length > 4) {
    return false;
  }

  if (segments[0] !== merchantId || segments[1] !== 'blog') {
    return false;
  }

  const safeSegment = /^[a-zA-Z0-9._-]+$/;
  if (!safeSegment.test(segments[2])) {
    return false;
  }

  if (segments.length === 3) {
    return segments[2].includes('.');
  }

  return (
    !segments[2].includes('.') &&
    BLOG_FEATURED_VARIANT_FILENAME.test(segments[3])
  );
}

export function extractManagedBlogStoragePath(
  publicUrl: string,
  merchantId: string
): string | null {
  try {
    const parsed = new URL(publicUrl);
    const path = decodeURIComponent(parsed.pathname);
    const bucketPathMarker = '/storage/v1/object/public/media/';
    const directMediaMarker = '/media/';

    const managedPath = path.includes(bucketPathMarker)
      ? path.slice(path.indexOf(bucketPathMarker) + bucketPathMarker.length)
      : path.includes(directMediaMarker)
        ? path.slice(path.indexOf(directMediaMarker) + directMediaMarker.length)
        : '';

    const normalized = managedPath.replace(/^\/+/, '');
    if (!isManagedBlogStoragePath(normalized, merchantId)) {
      return null;
    }

    return normalized;
  } catch {
    return null;
  }
}
