import type { SupabaseClient } from '@supabase/supabase-js';

export async function getMerchantBlogPostCategories(
  supabase: SupabaseClient,
  merchantId: string
): Promise<string[]> {
  const { data: posts, error } = await supabase
    .from('blog_posts')
    .select('category')
    .eq('merchant_id', merchantId);

  if (error) {
    console.error('Failed to fetch merchant blog post categories:', {
      merchantId,
      error,
    });
    throw error;
  }

  return Array.from(
    new Set(
      (posts ?? [])
        .map((post) => post.category?.trim().toLowerCase() ?? '')
        .filter((category): category is string => category.length > 0)
    )
  );
}
