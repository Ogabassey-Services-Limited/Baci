import type { SupabaseClient } from '@supabase/supabase-js';

interface LinkedBlogPostRow {
  blog_posts?:
    | {
        published_at?: string | null;
        slug?: string | null;
        status?: string | null;
      }
    | Array<{
        published_at?: string | null;
        slug?: string | null;
        status?: string | null;
      }>
    | null;
}

function getBlogPostRow(value: LinkedBlogPostRow['blog_posts']): {
  published_at?: string | null;
  slug?: string | null;
  status?: string | null;
} | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

/**
 * Find published storefront blog posts that embed any of the changed
 * products. Product mutations use this bounded relationship query to evict
 * the exact edge-cached article URLs whose related-product rail can change;
 * unrelated blog posts are not purged. Any read failure is fail-open because
 * cache expiry remains safe and a product mutation must not fail on best-effort
 * CDN invalidation.
 */
export async function getPublishedBlogPostSlugsForProducts(
  supabase: SupabaseClient,
  merchantId: string,
  productIds: readonly string[]
): Promise<string[]> {
  const normalizedMerchantId = merchantId.trim();
  const normalizedProductIds = Array.from(
    new Set(
      productIds
        .map((productId) => productId.trim())
        .filter((productId) => productId.length > 0)
    )
  );

  if (!normalizedMerchantId || normalizedProductIds.length === 0) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('blog_post_products')
      .select('blog_posts!inner(slug, status, published_at)')
      .eq('merchant_id', normalizedMerchantId)
      .in('product_id', normalizedProductIds);

    if (error) {
      console.error(
        'Failed to resolve published blog posts for product purge (continuing without article purge):',
        { merchantId: normalizedMerchantId, error }
      );
      return [];
    }

    return Array.from(
      new Set(
        (data as unknown as LinkedBlogPostRow[] | null | undefined)
          ?.map((row) => getBlogPostRow(row.blog_posts))
          .filter(
            (
              post
            ): post is {
              published_at: string;
              slug: string;
              status: 'published';
            } =>
              post?.status === 'published' &&
              typeof post.published_at === 'string' &&
              post.published_at.length > 0 &&
              typeof post.slug === 'string'
          )
          .map((post) => post.slug.trim().toLowerCase())
          .filter((slug) => slug.length > 0) ?? []
      )
    );
  } catch (error) {
    console.error(
      'Failed to resolve published blog posts for product purge (continuing without article purge):',
      { merchantId: normalizedMerchantId, error }
    );
    return [];
  }
}
