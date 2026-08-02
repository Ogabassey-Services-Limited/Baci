import type { SupabaseClient } from '@supabase/supabase-js';

export async function validateUpdatedBlogPostSlug({
  currentSlug,
  merchantId,
  postId,
  slug,
  supabase,
}: {
  currentSlug: string;
  merchantId: string;
  postId: string;
  slug: unknown;
  supabase: SupabaseClient;
}): Promise<'available' | 'conflict' | 'error'> {
  if (typeof slug !== 'string' || slug === currentSlug) return 'available';

  const { data: existingPost, error } = await supabase
    .from('blog_posts')
    .select('id')
    .eq('merchant_id', merchantId)
    .eq('slug', slug)
    .neq('id', postId)
    .maybeSingle();
  if (error) {
    console.error('Failed to validate blog post slug:', {
      merchantId,
      postId,
      slug,
      error,
    });
    return 'error';
  }

  return existingPost ? 'conflict' : 'available';
}
