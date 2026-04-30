import type { SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_AGENTIC_MERCHANT_SLUG = 'ogabassey';

export interface AgenticMerchantContext {
  business_name: string | null;
  custom_domain?: string;
  id: string;
  paystack_subaccount_code: string | null;
  slug: string;
}

export function getConfiguredAgenticMerchantSlug(): string {
  return (
    process.env.OPENAI_AGENTIC_MERCHANT_SLUG?.trim() ||
    DEFAULT_AGENTIC_MERCHANT_SLUG
  );
}

export async function resolveAgenticMerchantContext(
  supabase: SupabaseClient
): Promise<AgenticMerchantContext | null> {
  const merchantSlug = getConfiguredAgenticMerchantSlug();

  const { data, error } = await supabase
    .from('merchants')
    .select('id, slug, business_name, custom_domain, paystack_subaccount_code')
    .eq('slug', merchantSlug)
    .maybeSingle();

  if (error || !data || typeof data.id !== 'string') {
    return null;
  }

  return {
    business_name:
      typeof data.business_name === 'string' ? data.business_name : null,
    custom_domain:
      typeof data.custom_domain === 'string' ? data.custom_domain : undefined,
    id: data.id,
    paystack_subaccount_code:
      typeof data.paystack_subaccount_code === 'string'
        ? data.paystack_subaccount_code
        : null,
    slug: typeof data.slug === 'string' ? data.slug : merchantSlug,
  };
}
