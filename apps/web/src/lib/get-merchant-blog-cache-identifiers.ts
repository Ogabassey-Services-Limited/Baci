import type { SupabaseClient } from '@supabase/supabase-js';

function normalizeBlogIdentifier(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

export async function getMerchantBlogCacheIdentifiers(
  supabase: SupabaseClient,
  merchantId: string
): Promise<string[]> {
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

  return Array.from(identifiers);
}
