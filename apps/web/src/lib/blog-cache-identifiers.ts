import type { SupabaseClient } from '@supabase/supabase-js';

export async function getMerchantBlogCacheIdentifiers(
  supabase: SupabaseClient,
  merchantId: string
): Promise<string[]> {
  const { data: merchant } = await supabase
    .from('merchants')
    .select('slug')
    .eq('id', merchantId)
    .maybeSingle();

  return merchant?.slug ? [merchant.slug] : [];
}
