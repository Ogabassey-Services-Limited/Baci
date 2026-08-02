import type { SupabaseClient } from '@supabase/supabase-js';

type BlogPostMerchantLookup =
  | { businessName: string | null; kind: 'found'; slug: string | null }
  | { kind: 'not-found' }
  | { kind: 'error' };

export async function loadBlogPostMerchant({
  merchantId,
  supabase,
}: {
  merchantId: string;
  supabase: SupabaseClient;
}): Promise<BlogPostMerchantLookup> {
  const { data, error } = await supabase
    .from('merchants')
    .select('business_name, slug')
    .eq('id', merchantId)
    .single();
  if (error?.code === 'PGRST116') return { kind: 'not-found' };
  if (error) {
    console.error('Failed to fetch merchant details for blog post creation:', {
      merchantId,
      error,
    });
    return { kind: 'error' };
  }
  if (!data) return { kind: 'not-found' };

  return {
    businessName:
      typeof data.business_name === 'string' ? data.business_name : null,
    kind: 'found',
    slug: typeof data.slug === 'string' ? data.slug : null,
  };
}
