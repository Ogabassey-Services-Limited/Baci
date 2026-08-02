import type { SupabaseClient } from '@supabase/supabase-js';
import { getConfiguredAgenticMerchantSlug } from './merchant-context';

type MerchantIdentityLookupClient = Pick<SupabaseClient, 'from'>;

export interface AgenticMerchantIdentity {
  id: string;
  slug: string;
  businessName: string | null;
}

export async function resolveAgenticMerchantIdentity(
  client: MerchantIdentityLookupClient
): Promise<AgenticMerchantIdentity | null> {
  const slug = getConfiguredAgenticMerchantSlug();
  if (!slug) {
    return null;
  }

  const { data, error } = await client
    .from('merchants')
    .select('id, slug, business_name')
    .eq('slug', slug)
    .maybeSingle<{
      id: string;
      slug: string;
      business_name: string | null;
    }>();

  if (error || !data?.id || !data.slug) {
    return null;
  }

  return {
    id: data.id,
    slug: data.slug,
    businessName: data.business_name,
  };
}
