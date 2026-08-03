import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { getBlogAuthorBySlug, getBlogAuthorSlugs } from '@/lib/blog-authors';
import { getBlogStructuredDataImageUrls } from '@/lib/blog-structured-data-images';
import {
  filterPublicBlogPosts,
  isPublicBlogCategory,
} from '@/lib/public-blog-content-quality';
import { isStorefrontSitemapPublished } from '@/lib/storefront-seo/is-storefront-sitemap-published';
import { resolveStorefrontSitemapContext } from '../../sitemap-data';
import {
  canUseCleanBlogCategorySlug,
  getBlogCategorySlug,
} from './blog-category-routing';

export const preferredRegion = 'dub1';

export const dynamic = 'force-dynamic';

const MIN_CATEGORY_HUB_POSTS = 3;

interface BlogCategorySitemapPost {
  category?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
}

interface BlogCategorySitemapEntry {
  category: string;
  lastModified: string;
}

function getBlogCategorySitemapEntries<TPost extends BlogCategorySitemapPost>(
  posts: TPost[]
): BlogCategorySitemapEntry[] {
  const stats = new Map<
    string,
    {
      category: string;
      count: number;
      labels: Set<string>;
      lastModified: string;
    }
  >();

  for (const post of posts) {
    const category = post.category?.trim();
    const lastModified = post.updated_at || post.published_at;
    if (!category || !lastModified || !isPublicBlogCategory(category)) {
      continue;
    }

    const key = getBlogCategorySlug(category);
    if (!canUseCleanBlogCategorySlug(key)) {
      continue;
    }

    const existing = stats.get(key);
    if (!existing) {
      stats.set(key, {
        category,
        count: 1,
        labels: new Set([category]),
        lastModified,
      });
      continue;
    }

    existing.count += 1;
    existing.labels.add(category);
    if (
      new Date(lastModified).getTime() >
      new Date(existing.lastModified).getTime()
    ) {
      existing.lastModified = lastModified;
    }
  }

  return Array.from(stats.values())
    .filter(
      (entry) =>
        entry.count >= MIN_CATEGORY_HUB_POSTS && entry.labels.size === 1
    )
    .map(({ category, lastModified }) => ({ category, lastModified }));
}

/**
 * Blog-specific sitemap for Search Console properties scoped to /blog.
 * Generates ogabassey.com/blog/sitemap.xml
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = await headers();
  const context = await resolveStorefrontSitemapContext(headersList);

  if (!context) return [];
  const { merchant, storeUrl, supabase } = context;

  // Mirror the blog feature flag guard used in getCachedBlogListing /
  // getCachedBlogPost so disabled storefronts don't expose a sitemap
  // pointing at routes that return 404.
  if (
    !isStorefrontSitemapPublished(merchant) ||
    !merchant.feature_settings?.blog_enabled
  ) {
    return [];
  }

  const { data: posts, error } = await supabase
    .from('blog_posts')
    .select(
      'slug, title, category, author_name, published_at, updated_at, featured_image_url, featured_image_variants'
    )
    .eq('merchant_id', merchant.id)
    .eq('status', 'published')
    .not('published_at', 'is', null);

  if (error) {
    throw new Error('Failed to fetch blog posts for sitemap', { cause: error });
  }

  const publicPosts = filterPublicBlogPosts(posts || []);
  const categoryEntries = getBlogCategorySitemapEntries(publicPosts);

  const entries: MetadataRoute.Sitemap = [
    {
      url: `${storeUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ];

  for (const categoryEntry of categoryEntries) {
    entries.push({
      url: `${storeUrl}/blog/category/${getBlogCategorySlug(categoryEntry.category)}`,
      lastModified: new Date(categoryEntry.lastModified),
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  }

  for (const post of publicPosts) {
    const lastModified = post.updated_at || post.published_at;
    if (!lastModified) {
      continue;
    }
    const imageUrls = getBlogStructuredDataImageUrls(post);

    entries.push({
      url: `${storeUrl}/blog/${post.slug}`,
      lastModified: new Date(lastModified),
      changeFrequency: 'monthly',
      priority: 0.8,
      ...(imageUrls.length > 0 && { images: imageUrls }),
    });
  }

  // Author hub pages (tenant-gated; OgaBassey only today). Only list an author
  // when they actually have published public posts — the hub `notFound()`s
  // otherwise (the route matches by exact author_name) — and derive lastmod from
  // that author's most recent post so the value reflects real content changes.
  for (const authorSlug of getBlogAuthorSlugs()) {
    const profile = getBlogAuthorBySlug(authorSlug, merchant.slug);
    if (!profile) {
      continue;
    }
    let lastModified: string | null = null;
    for (const post of publicPosts) {
      if (post.author_name !== profile.name) {
        continue;
      }
      const timestamp = post.updated_at || post.published_at;
      if (timestamp && (!lastModified || timestamp > lastModified)) {
        lastModified = timestamp;
      }
    }
    if (!lastModified) {
      continue;
    }
    entries.push({
      url: `${storeUrl}/blog/author/${authorSlug}`,
      lastModified: new Date(lastModified),
      changeFrequency: 'weekly',
      priority: 0.6,
    });
  }

  return entries;
}
