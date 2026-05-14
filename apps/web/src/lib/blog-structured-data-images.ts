import { BLOG_FEATURED_VARIANT_KEYS } from '@/lib/blog-managed-storage-paths';

type BlogStructuredDataImageSource = {
  featured_image_url?: string | null;
  featured_image_variants?: Record<string, unknown> | null;
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
