import { BLOG_FEATURED_VARIANT_KEYS } from '@/lib/blog-managed-storage-paths';

type BlogStructuredDataImageSource = {
  featured_image_url?: string | null;
  featured_image_width?: number | null;
  featured_image_height?: number | null;
  featured_image_variants?: Record<string, unknown> | null;
};

export type BlogStructuredDataImageObject = {
  '@type': 'ImageObject';
  url: string;
  width?: number;
  height?: number;
};

const BLOG_FEATURED_VARIANT_DIMENSIONS: Record<
  (typeof BLOG_FEATURED_VARIANT_KEYS)[number],
  { width: number; height: number }
> = {
  landscape_16x9: { width: 1200, height: 675 },
  standard_4x3: { width: 1200, height: 900 },
  square_1x1: { width: 1200, height: 1200 },
};

function getStringUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? parsed.href
      : null;
  } catch {
    return null;
  }
}

function getVariantMap(
  variants: BlogStructuredDataImageSource['featured_image_variants']
): Record<string, unknown> {
  return variants && typeof variants === 'object' && !Array.isArray(variants)
    ? variants
    : {};
}

function dedupeUrls(urls: string[]): string[] {
  return [...new Set(urls)];
}

function getPositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

export function getBlogStructuredDataImageUrls(
  source: BlogStructuredDataImageSource | null | undefined
): string[] {
  if (!source) {
    return [];
  }

  const variants = getVariantMap(source.featured_image_variants);
  const variantUrls = BLOG_FEATURED_VARIANT_KEYS.flatMap((key) => {
    const url = getStringUrl(variants[key]);
    return url ? [url] : [];
  });

  if (variantUrls.length > 0) {
    return dedupeUrls(variantUrls);
  }

  const originalUrl = getStringUrl(source.featured_image_url);
  return originalUrl ? [originalUrl] : [];
}

export function getBlogStructuredDataImages(
  source: BlogStructuredDataImageSource | null | undefined
): BlogStructuredDataImageObject[] {
  if (!source) {
    return [];
  }

  const variants = getVariantMap(source.featured_image_variants);
  const seen = new Set<string>();
  const images: BlogStructuredDataImageObject[] = [];

  for (const key of BLOG_FEATURED_VARIANT_KEYS) {
    const url = getStringUrl(variants[key]);
    if (!url || seen.has(url)) {
      continue;
    }
    seen.add(url);
    images.push({
      '@type': 'ImageObject',
      url,
      ...BLOG_FEATURED_VARIANT_DIMENSIONS[key],
    });
  }

  if (images.length > 0) {
    return images;
  }

  const originalUrl = getStringUrl(source.featured_image_url);
  if (!originalUrl) {
    return [];
  }

  const width = getPositiveInteger(source.featured_image_width);
  const height = getPositiveInteger(source.featured_image_height);

  return [
    {
      '@type': 'ImageObject',
      url: originalUrl,
      ...(width && height ? { width, height } : {}),
    },
  ];
}
