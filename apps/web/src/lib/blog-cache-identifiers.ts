import type { SupabaseClient } from '@supabase/supabase-js';

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
    return [];
  }

  const identifiers = new Set<string>();

  if (merchant?.slug) {
    identifiers.add(merchant.slug.trim().toLowerCase());
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
    return Array.from(identifiers);
  }

  for (const domain of domains ?? []) {
    if (domain?.domain) {
      identifiers.add(domain.domain.trim().toLowerCase());
    }
  }

  return Array.from(identifiers);
}

export async function getMerchantBlogPostSlugs(
  supabase: SupabaseClient,
  merchantId: string
): Promise<string[]> {
  const { data: posts, error } = await supabase
    .from('blog_posts')
    .select('slug')
    .eq('merchant_id', merchantId);

  if (error) {
    console.error('Failed to fetch merchant blog post slugs:', {
      merchantId,
      error,
    });
    return [];
  }

  return Array.from(
    new Set(
      (posts ?? [])
        .map((post) => post.slug?.trim().toLowerCase())
        .filter((slug): slug is string => Boolean(slug))
    )
  );
}
