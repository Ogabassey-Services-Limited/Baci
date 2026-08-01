import {
  BLOG_FEATURED_VARIANT_KEYS,
  type BlogFeaturedVariantKey,
} from '@/lib/blog-managed-storage-paths';
import type {
  FeaturedImageVariantPaths,
  FeaturedImageVariants,
  PostFormData,
} from './edit-blog-types';

export const INITIAL_FORM_DATA: PostFormData = {
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
  keywords: '',
  author_name: '',
  author_title: '',
  author_bio: '',
  seo_title: '',
  seo_description: '',
  focus_keyword: '',
  status: 'draft',
  published_at: null,
};

export function normalizeFeaturedImageVariantMap(
  value: unknown
): FeaturedImageVariants {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const input = value as Partial<Record<BlogFeaturedVariantKey, unknown>>;
  const normalized: FeaturedImageVariants = {};
  for (const key of BLOG_FEATURED_VARIANT_KEYS) {
    const variantUrl = input[key];
    if (typeof variantUrl === 'string' && variantUrl.trim())
      normalized[key] = variantUrl;
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
    if (typeof variantPath === 'string' && variantPath.trim())
      normalized[key] = variantPath;
  }
  return normalized;
}

export function withFeaturedImageDefaults(data: PostFormData): PostFormData {
  return {
    ...data,
    featured_image_width: data.featured_image_width ?? null,
    featured_image_height: data.featured_image_height ?? null,
    featured_image_variants: normalizeFeaturedImageVariantMap(
      data.featured_image_variants
    ),
  };
}

export function getFeaturedImagePreviewUrl(data: PostFormData): string {
  return data.featured_image_variants.landscape_16x9 || data.featured_image_url;
}

export function normalizePostFormData(data: PostFormData): PostFormData {
  const publishedAt = data.published_at;
  if (!publishedAt) return withFeaturedImageDefaults(data);
  const parsed = new Date(publishedAt);
  return withFeaturedImageDefaults({
    ...data,
    published_at: Number.isNaN(parsed.getTime())
      ? publishedAt
      : parsed.toISOString(),
  });
}
