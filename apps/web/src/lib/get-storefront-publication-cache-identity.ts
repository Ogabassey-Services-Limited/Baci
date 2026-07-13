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
  const [domainsResult, aliasesResult] = await Promise.all([
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

  const normalizedCanonicalSlug = normalizeIdentity(canonicalMerchantSlug);
  const merchantSlugs = new Set<string>();
  const customDomains = new Set<string>();
  if (normalizedCanonicalSlug) {
    merchantSlugs.add(normalizedCanonicalSlug);
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
