import type { SupabaseClient } from '@supabase/supabase-js';
import { RELATED_BLOG_PRODUCT_LINKS_SELECT } from '@/lib/related-blog-products';

export function getOrderedBlogPostProductLinks(
  supabase: SupabaseClient,
  merchantId: string,
  blogPostId: string
) {
  return supabase
    .from('blog_post_products')
    .select(RELATED_BLOG_PRODUCT_LINKS_SELECT)
    .eq('merchant_id', merchantId)
    .eq('blog_post_id', blogPostId)
    .order('position', { ascending: true });
}
