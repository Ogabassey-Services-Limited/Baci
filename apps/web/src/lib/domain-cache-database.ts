import type { SupabaseClient } from '@supabase/supabase-js';

export async function fetchSlugForDomain(
  supabase: SupabaseClient,
  domain: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('domains')
      .select('merchants!inner(slug)')
      .eq('domain', domain)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[Domain Cache] Failed to fetch slug for domain', {
        domain,
        error,
      });
      return null;
    }
    if (!data) return null;

    const merchant = data.merchants as unknown as { slug: string };
    return merchant.slug ?? null;
  } catch (error) {
    console.error('[Domain Cache] Error fetching slug for domain', {
      domain,
      error,
    });
    return null;
  }
}

export async function fetchCustomDomain(
  supabase: SupabaseClient,
  merchantSlug: string
): Promise<string | null> {
  try {
    const { data: merchant, error } = await supabase
      .from('merchants')
      .select('id, domains!left(domain, is_primary, status, domain_type)')
      .eq('slug', merchantSlug)
      .maybeSingle();

    if (error) {
      console.error('[Domain Cache] Failed to fetch merchant domain data', {
        merchantSlug,
        error,
      });
      return null;
    }
    if (!merchant) return null;

    const domains = merchant.domains as Array<{
      domain: string;
      is_primary: boolean;
      status: string;
      domain_type: string;
    }> | null;
    const activeCustomDomains =
      domains?.filter(
        (domain) =>
          domain.status === 'active' &&
          (domain.domain_type === 'custom' ||
            domain.domain_type === 'purchased')
      ) ?? [];
    const primaryDomain = activeCustomDomains.find(
      (domain) => domain.is_primary
    );

    if (primaryDomain) return primaryDomain.domain;
    return activeCustomDomains.length === 1
      ? activeCustomDomains[0].domain
      : null;
  } catch {
    return null;
  }
}
