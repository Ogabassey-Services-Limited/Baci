import type { MetadataRoute } from 'next';
import { getProductUrl } from '@/lib/seo-utils';

export interface ProductWithCategory {
  id: string;
  name?: string | null;
  slug: string | null;
  category: string | null;
  canonical_url: string | null;
  images: unknown;
  updated_at: string | null;
  categories: { slug: string | null } | null;
}

export function buildProductSitemapEntry({
  product,
  storeUrl,
}: {
  product: ProductWithCategory;
  storeUrl: string;
}): MetadataRoute.Sitemap[number] {
  const normalizedJoinedCategory =
    product.categories?.slug && product.categories.slug.trim().length > 0
      ? { slug: product.categories.slug.trim() }
      : null;
  const url = `${storeUrl}${getProductUrl({
    id: product.id,
    slug: product.slug ?? undefined,
    name: product.name ?? '',
    category: product.category,
    categories: normalizedJoinedCategory,
    canonical_url: product.canonical_url,
  })}`;
  const images: string[] = [];

  if (Array.isArray(product.images)) {
    for (const image of product.images) {
      const imageUrl =
        typeof image === 'string'
          ? image
          : (image as Record<string, unknown>)?.url;
      if (typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
        images.push(imageUrl);
      }
    }
  }

  return {
    url,
    lastModified: product.updated_at ? new Date(product.updated_at) : undefined,
    changeFrequency: 'weekly',
    priority: 0.8,
    ...(images.length > 0 && { images }),
  };
}
