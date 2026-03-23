import type { SupabaseClient } from '@supabase/supabase-js';

export async function getMerchantBlogPostSlugs(
  supabase: SupabaseClient,
  merchantId: string
): Promise<string[]> {
  const { data: posts, error } = await supabase
    .from('blog_posts')
    .select('slug')
    .eq('merchant_id', merchantId);

  if (error) {
    console.error('Failed to fetch merchant blog post slugs:', {
      merchantId,
      error,
    });
    throw error;
  }

  return Array.from(
    new Set(
      (posts ?? [])
        .map((post) => post.slug?.trim().toLowerCase() ?? '')
        .filter((slug): slug is string => slug.length > 0)
    )
  );
}
