import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getAgenticApiKey,
  getAgenticConfirmationKeys,
  getAgenticMerchantSlug,
  getAgenticSigningKeys,
  getPaystackSecretKey,
  getSupabaseJwtSecret,
} from '@/env';

export interface AgenticMerchantContext {
  business_name: string | null;
  custom_domain?: string;
  id: string;
  paystack_subaccount_code: string | null;
  slug: string;
}

export function getConfiguredAgenticMerchantSlug(): string | undefined {
  return getAgenticMerchantSlug();
}

export function isAgenticCheckoutRuntimeConfigured(): boolean {
  const confirmationKeys = getAgenticConfirmationKeys();
  const signingKeys = getAgenticSigningKeys();
  let supabaseJwtSecret: string | undefined;
  try {
    supabaseJwtSecret = getSupabaseJwtSecret();
  } catch {
    supabaseJwtSecret = undefined;
  }

  return Boolean(
    getConfiguredAgenticMerchantSlug() &&
      getAgenticApiKey() &&
      hasOnlyNonBlankEntries(confirmationKeys) &&
      hasOnlyNonBlankEntries(signingKeys) &&
      // Optional Paystack getter trims runtime env and returns undefined when absent.
      getPaystackSecretKey() &&
      supabaseJwtSecret
  );
}

function hasOnlyNonBlankEntries(values: readonly string[]): boolean {
  return values.length > 0 && values.every((value) => value.trim().length > 0);
}

export async function resolveAgenticMerchantContext(
  supabase: SupabaseClient
): Promise<AgenticMerchantContext | null> {
  const merchantSlug = getConfiguredAgenticMerchantSlug();
  if (!merchantSlug) {
    return null;
  }

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
