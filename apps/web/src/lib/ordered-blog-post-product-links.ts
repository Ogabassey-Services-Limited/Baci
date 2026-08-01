import type { SupabaseClient } from '@supabase/supabase-js';
import { RELATED_BLOG_PRODUCT_LINKS_SELECT } from '@/lib/related-blog-products';

function isMissingPositionColumnError(error: unknown) {
  if (!error || typeof error !== 'object') return false;

  const { code, message } = error as {
    code?: unknown;
    message?: unknown;
  };

  return (
    code === '42703' &&
    typeof message === 'string' &&
    /column\s+(?:[a-z_]+\.)?position\s+does not exist/i.test(message)
  );
}

export async function getOrderedBlogPostProductLinks(
  supabase: SupabaseClient,
  merchantId: string,
  blogPostId: string
) {
  const canonicalResult = await supabase
    .from('blog_post_products')
    .select(RELATED_BLOG_PRODUCT_LINKS_SELECT)
    .eq('merchant_id', merchantId)
    .eq('blog_post_id', blogPostId)
    .order('position', { ascending: true });

  if (!isMissingPositionColumnError(canonicalResult.error)) {
    return canonicalResult;
  }

  return supabase
    .from('blog_post_products')
    .select(RELATED_BLOG_PRODUCT_LINKS_SELECT)
    .eq('merchant_id', merchantId)
    .eq('blog_post_id', blogPostId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
}
