import type { SupabaseClient } from '@supabase/supabase-js';

function normalizeBlogIdentifier(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

export interface MerchantBlogRevalidationContext {
  identifiers: string[];
  canonicalMerchantSlug: string | null;
}

/**
 * Returns all merchant identifier forms used by legacy blog cache/tag/path
 * invalidation. The returned array is not a canonical ordering contract.
 */
export async function getMerchantBlogCacheIdentifiers(
  supabase: SupabaseClient,
  merchantId: string
): Promise<string[]> {
  const context = await getMerchantBlogRevalidationContext(
    supabase,
    merchantId
  );
  return context.identifiers;
}

/**
 * Returns merchant identifier forms plus the canonical merchant slug needed by
 * mutation routes to invalidate `/api/blog/feed/<slug>` without guessing from
 * identifier ordering.
 */
export async function getMerchantBlogRevalidationContext(
  supabase: SupabaseClient,
  merchantId: string
): Promise<MerchantBlogRevalidationContext> {
  const { data: merchant, error: merchantError } = await supabase
    .from('merchants')
    .select('slug')
    .eq('id', merchantId)
    .maybeSingle();

  if (merchantError) {
    console.error('Failed to fetch merchant blog cache identifiers:', {
      merchantId,
      error: merchantError,
    });
    throw merchantError;
  }

  const identifiers = new Set<string>();
  const normalizedMerchantSlug = normalizeBlogIdentifier(merchant?.slug);

  if (normalizedMerchantSlug.length > 0) {
    identifiers.add(normalizedMerchantSlug);
  }

  const { data: domains, error: domainsError } = await supabase
    .from('domains')
    .select('domain')
    .eq('merchant_id', merchantId)
    .eq('status', 'active')
    .in('domain_type', ['custom', 'purchased']);

  if (domainsError) {
    console.error('Failed to fetch merchant blog domain identifiers:', {
      merchantId,
      error: domainsError,
    });
    throw domainsError;
  }

  for (const domain of domains ?? []) {
    const normalizedDomain = normalizeBlogIdentifier(domain?.domain);

    if (normalizedDomain.length > 0) {
      identifiers.add(normalizedDomain);
    }
  }

  return {
    identifiers: Array.from(identifiers),
    canonicalMerchantSlug:
      normalizedMerchantSlug.length > 0 ? normalizedMerchantSlug : null,
  };
}
