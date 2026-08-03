import type { SupabaseClient } from '@supabase/supabase-js';
import type { CurrencyConfig } from '@/lib/currency';
import { resolveMerchantCurrencyConfig } from '@/lib/resolve-merchant-currency';
import { getConfiguredAgenticMerchantSlug } from './agentic-merchant-slug';

type MerchantIdentityLookupClient = Pick<SupabaseClient, 'from'>;

export interface AgenticMerchantIdentity {
  /** False when the tenant's agentic checkout feature is explicitly disabled. */
  agenticCheckoutEnabled?: boolean;
  currency?: CurrencyConfig;
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
    .select('id, slug, business_name, country, payout_currency')
    .eq('slug', slug)
    .maybeSingle<{
      country: string | null;
      id: string;
      payout_currency: string | null;
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
    currency: resolveMerchantCurrencyConfig(data),
  };
}
