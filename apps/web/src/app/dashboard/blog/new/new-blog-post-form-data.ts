import {
  BLOG_FEATURED_VARIANT_KEYS,
  type BlogFeaturedVariantKey,
  extractManagedBlogStoragePath,
} from '@/lib/blog-managed-storage-paths';
import type {
  FeaturedImageVariantPaths,
  FeaturedImageVariants,
  NewBlogPostFormData,
  UploadedFeaturedImage,
} from './new-blog-post-types';

export function createEmptyPostFormData(
  authorName: string
): NewBlogPostFormData {
  return {
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    featured_image_url: '',
    featured_image_alt: '',
    featured_image_width: null,
    featured_image_height: null,
    featured_image_variants: {},
    category: '',
    tags: '',
    author_name: authorName,
    author_title: '',
    author_bio: '',
    seo_title: '',
    seo_description: '',
  };
}

export function normalizeFeaturedImageVariantMap(
  value: unknown
): FeaturedImageVariants {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const input = value as Partial<Record<BlogFeaturedVariantKey, unknown>>;
  const normalized: FeaturedImageVariants = {};
  for (const key of BLOG_FEATURED_VARIANT_KEYS) {
    const variantUrl = input[key];
    if (typeof variantUrl === 'string' && variantUrl.trim()) {
      normalized[key] = variantUrl;
    }
  }
  return normalized;
}

export function normalizeFeaturedImageVariantPaths(
  value: unknown
): FeaturedImageVariantPaths {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const input = value as Partial<Record<BlogFeaturedVariantKey, unknown>>;
  const normalized: FeaturedImageVariantPaths = {};
  for (const key of BLOG_FEATURED_VARIANT_KEYS) {
    const variantPath = input[key];
    if (typeof variantPath === 'string' && variantPath.trim()) {
      normalized[key] = variantPath;
    }
  }
  return normalized;
}

export function withFeaturedImageDefaults(
  data: NewBlogPostFormData
): NewBlogPostFormData {
  return {
    ...data,
    featured_image_width: data.featured_image_width ?? null,
    featured_image_height: data.featured_image_height ?? null,
    featured_image_variants: normalizeFeaturedImageVariantMap(
      data.featured_image_variants
    ),
  };
}

export function getFeaturedImagePreviewUrl(data: NewBlogPostFormData): string {
  return data.featured_image_variants.landscape_16x9 || data.featured_image_url;
}

export function reconstructUploadedFeaturedImage(
  data: NewBlogPostFormData,
  merchantId: string | undefined
): UploadedFeaturedImage | null {
  if (!merchantId || !data.featured_image_url) return null;

  const path = extractManagedBlogStoragePath(
    data.featured_image_url,
    merchantId
  );
  if (!path) return null;

  const variantPaths: FeaturedImageVariantPaths = {};
  for (const key of BLOG_FEATURED_VARIANT_KEYS) {
    const variantUrl = data.featured_image_variants[key];
    if (!variantUrl) continue;
    const variantPath = extractManagedBlogStoragePath(variantUrl, merchantId);
    if (variantPath) variantPaths[key] = variantPath;
  }
  return { path, variantPaths };
}
