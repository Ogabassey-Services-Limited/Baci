import { cacheLife, cacheTag } from 'next/cache';
import { BLOG_LISTING_PAGE_SIZE } from '@/lib/blog-listing-page-size';
import { STOREFRONT_BLOG_POST_SELECT } from '@/lib/storefront-blog-post-select';
import { createPublicClient } from '@/lib/supabase/public';

const PLATFORM_BLOG_CLIENT_INFO = 'baci-web-platform-blog';
const PLATFORM_BLOG_QUERY_TIMEOUT_MS = 4000;
const MAX_LISTING_LIMIT = 100;
const PLATFORM_BLOG_FEED_LIMIT = 50;
const PLATFORM_BLOG_SITEMAP_LIMIT = 5000;

export const PLATFORM_BLOG_CACHE_TAG = 'platform-blog';
export const PLATFORM_BLOG_LIST_CACHE_TAG = 'platform-blog-list';
export const PLATFORM_BLOG_SITEMAP_CACHE_TAG = 'platform-blog-sitemap';
export const PLATFORM_BLOG_FEED_CACHE_TAG = 'platform-blog-feed';
export const PLATFORM_BLOG_SELECT = STOREFRONT_BLOG_POST_SELECT;

export interface PlatformBlogContext {
  baseUrl: string;
  businessName: string;
  logoUrl: string;
}

export const PLATFORM_BLOG_CONTEXT: PlatformBlogContext = {
  baseUrl: 'https://usebaci.com',
  businessName: 'Baci',
  logoUrl: 'https://usebaci.com/logo.png',
};

export interface PlatformBlogListingPost {
  author_image_url: string | null;
  author_name: string | null;
  category: string | null;
  excerpt: string | null;
  featured_image_alt: string | null;
  featured_image_url: string | null;
  id: string;
  published_at: string | null;
  reading_time_minutes: number | null;
  slug: string;
  tags: string[] | null;
  title: string;
  view_count: number | null;
}

export interface PlatformBlogPost extends PlatformBlogListingPost {
  author_bio: string | null;
  author_title: string | null;
  content: string | null;
  created_at: string;
  featured_image_height: number | null;
  featured_image_variants: Record<string, unknown> | null;
  featured_image_width: number | null;
  keywords: string[] | null;
  seo_description: string | null;
  seo_title: string | null;
  status: string;
  updated_at: string;
  word_count: number | null;
}

export interface PlatformBlogFeedPost {
  author_name: string | null;
  category: string | null;
  content: string | null;
  excerpt: string | null;
  featured_image_url: string | null;
  id: string;
  published_at: string | null;
  slug: string;
  title: string;
  updated_at: string | null;
}

export interface PlatformBlogSitemapPost {
  published_at: string | null;
  slug: string;
  updated_at: string | null;
}

export interface PlatformBlogListingResult {
  hasMore: boolean;
  limit: number;
  page: number;
  posts: PlatformBlogListingPost[];
  total: number;
  totalPages: number;
}

function getClient() {
  return createPublicClient({
    clientInfo: PLATFORM_BLOG_CLIENT_INFO,
    timeoutMs: PLATFORM_BLOG_QUERY_TIMEOUT_MS,
  });
}

function normalizeSlug(slug: unknown): string {
  if (typeof slug !== 'string') {
    return '';
  }

  return slug.trim().toLowerCase();
}

function normalizePositiveInt(
  value: number,
  fallback: number,
  max: number
): number {
  if (!Number.isInteger(value) || value < 1) {
    return fallback;
  }

  return Math.min(value, max);
}

function normalizeNonNegativeInt(value: number, fallback: number): number {
  if (!Number.isInteger(value) || value < 0) {
    return fallback;
  }

  return value;
}

export function getPlatformBlogPostCacheTag(slug: string): string {
  return `platform-blog-post-${normalizeSlug(slug)}`;
}

export function getPlatformBlogListCacheTag(page: number): string {
  return `platform-blog-list-page-${page}`;
}

function normalizeOptionalFilter(
  value: string | null | undefined
): string | null {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    return null;
  }

  return normalizedValue;
}

export function getScopedPlatformBlogListCacheTag({
  category,
  page,
  tag,
}: {
  category?: string | null;
  page: number;
  tag?: string | null;
}): string {
  const normalizedCategory = normalizeOptionalFilter(category);
  const normalizedTag = normalizeOptionalFilter(tag);

  if (!normalizedCategory && !normalizedTag) {
    return getPlatformBlogListCacheTag(page);
  }

  return `platform-blog-list-page-${page}:category-${encodeURIComponent(
    normalizedCategory ?? 'all'
  )}:tag-${encodeURIComponent(normalizedTag ?? 'all')}`;
}

export async function getPlatformBlogPost(
  slug: string
): Promise<PlatformBlogPost | null> {
  'use cache: remote';

  const normalizedSlug = normalizeSlug(slug);
  if (!normalizedSlug) {
    return null;
  }

  cacheLife('merchant');
  cacheTag(
    PLATFORM_BLOG_CACHE_TAG,
    getPlatformBlogPostCacheTag(normalizedSlug)
  );

  const { data, error } = await getClient()
    .from('blog_posts')
    .select(PLATFORM_BLOG_SELECT)
    .eq('is_platform_post', true)
    .is('merchant_id', null)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .eq('slug', normalizedSlug)
    .maybeSingle();

  if (error) {
    console.error('Failed to load platform blog post', {
      error,
      slug: normalizedSlug,
    });
    return null;
  }

  return (data as PlatformBlogPost | null) ?? null;
}

export async function getPlatformBlogListing(
  options: {
    category?: string | null;
    limit?: number;
    offset?: number;
    page?: number;
    tag?: string | null;
  } = {}
): Promise<PlatformBlogListingResult> {
  'use cache: remote';

  const category = normalizeOptionalFilter(options.category);
  const limit = normalizePositiveInt(
    options.limit ?? BLOG_LISTING_PAGE_SIZE,
    BLOG_LISTING_PAGE_SIZE,
    MAX_LISTING_LIMIT
  );
  const offset = normalizeNonNegativeInt(
    options.offset ??
      (normalizePositiveInt(options.page ?? 1, 1, Number.MAX_SAFE_INTEGER) -
        1) *
        limit,
    0
  );
  const page = Math.floor(offset / limit) + 1;
  const tag = normalizeOptionalFilter(options.tag);

  cacheLife('merchant');
  cacheTag(
    PLATFORM_BLOG_CACHE_TAG,
    PLATFORM_BLOG_LIST_CACHE_TAG,
    getScopedPlatformBlogListCacheTag({ category, page, tag })
  );

  let query = getClient()
    .from('blog_posts')
    .select(
      'id, title, slug, excerpt, featured_image_url, featured_image_alt, category, tags, author_name, author_image_url, reading_time_minutes, published_at, view_count',
      { count: 'exact' }
    )
    .eq('is_platform_post', true)
    .is('merchant_id', null)
    .eq('status', 'published')
    .not('published_at', 'is', null);

  if (category) {
    query = query.eq('category', category);
  }

  if (tag) {
    query = query.contains('tags', [tag]);
  }

  const { data, error, count } = await query
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Failed to load platform blog listing', {
      error,
      page,
      limit,
    });
    throw error;
  }

  const total = count ?? 0;
  const totalPages = total === 0 ? 1 : Math.ceil(total / limit);

  return {
    hasMore: offset + limit < total,
    limit,
    page,
    posts: (data as PlatformBlogListingPost[] | null) ?? [],
    total,
    totalPages,
  };
}

export async function incrementPlatformBlogPostViews(
  postId: string
): Promise<void> {
  const normalizedPostId = postId.trim();
  if (!normalizedPostId) {
    return;
  }

  const { error } = await getClient().rpc('increment_blog_post_views', {
    p_post_id: normalizedPostId,
  });

  if (error) {
    console.error('Failed to increment platform blog post views', {
      error,
      postId: normalizedPostId,
    });
    throw error;
  }
}

export async function getPlatformBlogFeedPosts(): Promise<
  PlatformBlogFeedPost[]
> {
  'use cache: remote';

  cacheLife('merchant');
  cacheTag(PLATFORM_BLOG_CACHE_TAG, PLATFORM_BLOG_FEED_CACHE_TAG);

  const { data, error } = await getClient()
    .from('blog_posts')
    .select(
      'id, title, slug, content, excerpt, featured_image_url, category, author_name, published_at, updated_at'
    )
    .eq('is_platform_post', true)
    .is('merchant_id', null)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(PLATFORM_BLOG_FEED_LIMIT);

  if (error) {
    console.error('Failed to load platform blog feed posts', { error });
    throw error;
  }

  return (data as PlatformBlogFeedPost[] | null) ?? [];
}

export async function getPlatformBlogSitemapPosts(): Promise<
  PlatformBlogSitemapPost[]
> {
  'use cache: remote';

  cacheLife('merchant');
  cacheTag(PLATFORM_BLOG_CACHE_TAG, PLATFORM_BLOG_SITEMAP_CACHE_TAG);

  const { data, error } = await getClient()
    .from('blog_posts')
    .select('slug, published_at, updated_at')
    .eq('is_platform_post', true)
    .is('merchant_id', null)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(PLATFORM_BLOG_SITEMAP_LIMIT);

  if (error) {
    console.error('Failed to load platform blog sitemap posts', { error });
    throw error;
  }

  return (data as PlatformBlogSitemapPost[] | null) ?? [];
}
