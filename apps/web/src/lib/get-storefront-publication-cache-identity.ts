import type { SupabaseClient } from '@supabase/supabase-js';

function normalizeIdentity(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

export interface StorefrontPublicationCacheIdentity {
  canonicalMerchantSlug: string | null;
  customDomains: readonly string[];
  identifiers: readonly string[];
  merchantId: string;
  merchantSlugs: readonly string[];
}

/**
 * Load every public identity that can address one merchant's cached storefront.
 * Publication changes must evict all of them: the current slug, every retired
 * slug, and every active custom or purchased domain.
 */
export async function getStorefrontPublicationCacheIdentity(
  supabase: SupabaseClient,
  merchantId: string,
  canonicalMerchantSlug: string | null | undefined
): Promise<StorefrontPublicationCacheIdentity> {
  const [merchantResult, domainsResult, aliasesResult] = await Promise.all([
    supabase
      .from('merchants')
      .select('slug')
      .eq('id', merchantId)
      .maybeSingle<{ slug: string | null }>(),
    supabase
      .from('domains')
      .select('domain')
      .eq('merchant_id', merchantId)
      .eq('status', 'active')
      .in('domain_type', ['custom', 'purchased']),
    supabase
      .from('merchant_slug_aliases')
      .select('old_slug')
      .eq('merchant_id', merchantId),
  ]);

  if (merchantResult.error) {
    console.error('Failed to refresh storefront publication slug', {
      error: merchantResult.error,
      merchantId,
    });
    throw merchantResult.error;
  }
  if (domainsResult.error) {
    console.error('Failed to load storefront publication domains', {
      error: domainsResult.error,
      merchantId,
    });
    throw domainsResult.error;
  }
  if (aliasesResult.error) {
    console.error('Failed to load storefront publication slug aliases', {
      error: aliasesResult.error,
      merchantId,
    });
    throw aliasesResult.error;
  }

  const normalizedCapturedSlug = normalizeIdentity(canonicalMerchantSlug);
  const normalizedCurrentSlug = normalizeIdentity(merchantResult.data?.slug);
  const normalizedCanonicalSlug =
    normalizedCurrentSlug || normalizedCapturedSlug;
  const merchantSlugs = new Set<string>();
  const customDomains = new Set<string>();
  for (const slug of [normalizedCurrentSlug, normalizedCapturedSlug]) {
    if (slug) {
      merchantSlugs.add(slug);
    }
  }

  for (const alias of aliasesResult.data ?? []) {
    const oldSlug = normalizeIdentity(alias?.old_slug);
    if (oldSlug) {
      merchantSlugs.add(oldSlug);
    }
  }
  for (const domain of domainsResult.data ?? []) {
    const hostname = normalizeIdentity(domain?.domain);
    if (hostname) {
      customDomains.add(hostname);
    }
  }

  const normalizedMerchantSlugs = Array.from(merchantSlugs);
  const normalizedCustomDomains = Array.from(customDomains);
  return {
    canonicalMerchantSlug: normalizedCanonicalSlug || null,
    customDomains: normalizedCustomDomains,
    identifiers: [...normalizedMerchantSlugs, ...normalizedCustomDomains],
    merchantId,
    merchantSlugs: normalizedMerchantSlugs,
  };
}
