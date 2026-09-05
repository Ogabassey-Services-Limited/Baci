import type { SupabaseClient } from '@supabase/supabase-js';

const PRODUCT_BLOG_POST_SLUGS_SELECT =
  'product_id, blog_posts!blog_post_products_blog_post_id_fkey(slug)' as const;

interface BlogPostSlugRow {
  blog_posts?: { slug?: string | null } | { slug?: string | null }[] | null;
}

/**
 * Resolve the published blog posts linked to changed products. The public RLS
 * policy on blog_post_products limits this read to published posts, so the
 * result is safe to use for edge-cache URL invalidation. The query is bounded
 * by the changed product IDs and fails through to the caller for fail-open
 * purge handling.
 */
export async function getProductBlogPostSlugs(
  supabase: SupabaseClient,
  merchantId: string,
  productIds: readonly string[]
): Promise<string[]> {
  const ids = Array.from(
    new Set(
      productIds
        .map((id) => id.trim())
        .filter((id): id is string => Boolean(id))
    )
  );
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('blog_post_products')
    .select(PRODUCT_BLOG_POST_SLUGS_SELECT)
    .eq('merchant_id', merchantId)
    .in('product_id', ids);

  if (error) throw error;

  const slugs = new Set<string>();
  for (const row of (data ?? []) as BlogPostSlugRow[]) {
    const blogPost = Array.isArray(row.blog_posts)
      ? row.blog_posts[0]
      : row.blog_posts;
    const slug = blogPost?.slug?.trim();
    if (slug) slugs.add(slug);
  }

  return Array.from(slugs);
}
