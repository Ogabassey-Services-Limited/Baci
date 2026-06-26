import { CONTENT_CLUSTER_SUPPORT } from '@/config/storefront-content-clusters';
import {
  getCachedFeatureSettings,
  getPublicSupabaseClient,
} from '@/lib/cached-data';
import type {
  PublishedClusterPost,
  SupportedClusterCategory,
} from '@/lib/storefront-content/content-cluster-types';

const SEO_LINK_CLUSTER_POST_CANDIDATE_LIMIT = 48;
const SEO_LINK_PRODUCT_GUIDE_LIMIT = 8;

type LinkedBlogPost = PublishedClusterPost & { status?: string | null };

interface LinkedBlogPostRow {
  blog_posts: LinkedBlogPost | LinkedBlogPost[] | null;
}

interface SeoQueryBuilder<TData> {
  select(columns: string): SeoQueryBuilder<TData>;
  eq(column: string, value: unknown): SeoQueryBuilder<TData>;
  not(column: string, operator: string, value: unknown): SeoQueryBuilder<TData>;
  or(filters: string): SeoQueryBuilder<TData>;
  order(
    column: string,
    options?: { ascending?: boolean }
  ): SeoQueryBuilder<TData>;
  limit(count: number): Promise<{ data: TData | null; error: unknown | null }>;
}

interface SeoSupabaseClient {
  from<TData>(table: string): SeoQueryBuilder<TData>;
}

function getSeoSupabaseClient(): SeoSupabaseClient {
  return getPublicSupabaseClient() as unknown as SeoSupabaseClient;
}

export async function getSeoGuidePosts(
  merchantId: string,
  productId: string,
  categorySlug = ''
): Promise<{
  clusterGuidePosts: PublishedClusterPost[];
  productGuidePosts: PublishedClusterPost[];
}> {
  try {
    if (!(await getSeoBlogEnabled(merchantId))) {
      return { clusterGuidePosts: [], productGuidePosts: [] };
    }

    const [clusterGuidePosts, productGuidePosts] = await Promise.all([
      getSeoClusterGuidePosts(merchantId, categorySlug),
      getSeoProductGuidePosts(merchantId, productId),
    ]);
    return { clusterGuidePosts, productGuidePosts };
  } catch (error) {
    console.error('Failed to load SEO guide posts', {
      merchantId,
      productId,
      error,
    });
    return { clusterGuidePosts: [], productGuidePosts: [] };
  }
}

async function getSeoBlogEnabled(merchantId: string): Promise<boolean> {
  const features = await getCachedFeatureSettings(merchantId);
  return Boolean(features?.blog_enabled);
}

async function getSeoClusterGuidePosts(
  merchantId: string,
  categorySlug: string
): Promise<PublishedClusterPost[]> {
  let query = getSeoSupabaseClient()
    .from<PublishedClusterPost[]>('blog_posts')
    .select(
      'slug, title, excerpt, category, tags, keywords, featured_image_url, published_at, reading_time_minutes'
    )
    .eq('merchant_id', merchantId)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false });

  const categoryFilter = buildGuideCategoryFilter(categorySlug);
  if (categoryFilter) {
    query = query.or(categoryFilter);
  }

  const { data, error } = await query.limit(
    SEO_LINK_CLUSTER_POST_CANDIDATE_LIMIT
  );

  return error ? [] : ((data ?? []) as PublishedClusterPost[]);
}

async function getSeoProductGuidePosts(
  merchantId: string,
  productId: string
): Promise<PublishedClusterPost[]> {
  if (!productId) {
    return [];
  }

  const { data, error } = await getSeoSupabaseClient()
    .from<LinkedBlogPostRow[]>('blog_post_products')
    .select(
      'blog_posts!inner(slug, title, excerpt, category, tags, keywords, featured_image_url, published_at, reading_time_minutes, status)'
    )
    .eq('merchant_id', merchantId)
    .eq('product_id', productId)
    .eq('blog_posts.status', 'published')
    .not('blog_posts.published_at', 'is', null)
    .order('created_at', { ascending: false })
    .limit(SEO_LINK_PRODUCT_GUIDE_LIMIT);

  return error
    ? []
    : (data ?? [])
        .map((row) => normalizeLinkedPost(row))
        .filter((post): post is PublishedClusterPost => Boolean(post));
}

function normalizeLinkedPost(
  row: LinkedBlogPostRow
): PublishedClusterPost | null {
  const post = Array.isArray(row.blog_posts)
    ? row.blog_posts[0]
    : row.blog_posts;
  if (!post?.slug || !post.title) {
    return null;
  }
  const { status: _status, ...publishedPost } = post;
  return publishedPost;
}

function buildGuideCategoryFilter(categorySlug: string): string | null {
  const searchTerms = getGuideCategorySearchTerms(categorySlug);
  if (searchTerms.length === 0) {
    return null;
  }

  const slugTerm = normalizeGuideCategorySlug(categorySlug);
  const filters = searchTerms.flatMap((searchTerm) => {
    const arrayTerm = formatPostgrestArrayTerm(searchTerm);
    return [
      `category.ilike.%${searchTerm}%`,
      `title.ilike.%${searchTerm}%`,
      `excerpt.ilike.%${searchTerm}%`,
      `tags.cs.{${arrayTerm}}`,
      `keywords.cs.{${arrayTerm}}`,
    ];
  });

  if (slugTerm) {
    filters.push(
      `slug.ilike.%${slugTerm}%`,
      `tags.cs.{${slugTerm}}`,
      `keywords.cs.{${slugTerm}}`
    );
  }

  return filters.length ? filters.join(',') : null;
}

function formatPostgrestArrayTerm(term: string): string {
  const escapedTerm = term.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return /[\s,{}"]/u.test(escapedTerm) ? `"${escapedTerm}"` : escapedTerm;
}

function getGuideCategorySearchTerms(categorySlug: string): string[] {
  const baseTerm = normalizeGuideCategorySearch(categorySlug);
  if (!baseTerm) {
    return [];
  }

  const support =
    CONTENT_CLUSTER_SUPPORT[
      normalizeGuideCategorySlug(categorySlug) as SupportedClusterCategory
    ];
  const terms = [
    baseTerm,
    ...(support?.categoryNames ?? []),
    ...(support?.articleTokens ?? []),
  ].map(normalizeGuideCategorySearch);

  return Array.from(new Set(terms.filter(Boolean)));
}

function normalizeGuideCategorySearch(categorySlug: string): string {
  let decoded = categorySlug;
  try {
    decoded = decodeURIComponent(categorySlug);
  } catch {
    decoded = categorySlug;
  }

  return decoded
    .replace(/[-_]+/g, ' ')
    .replace(/[,().]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeGuideCategorySlug(categorySlug: string): string {
  return normalizeGuideCategorySearch(categorySlug).replace(/\s+/g, '-');
}
