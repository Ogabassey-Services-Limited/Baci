import type { SupabaseClient } from '@supabase/supabase-js';

export async function getMerchantBlogCacheIdentifiers(
  supabase: SupabaseClient,
  merchantId: string
): Promise<string[]> {
  const { data: merchant, error } = await supabase
    .from('merchants')
    .select('slug')
    .eq('id', merchantId)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch merchant blog cache identifiers:', {
      merchantId,
      error,
    });
    return [];
  }

  return merchant?.slug ? [merchant.slug] : [];
}
