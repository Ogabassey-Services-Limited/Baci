import type { SupabaseClient } from '@supabase/supabase-js';

type HeaderReader = {
  headers: { get(name: string): string | null };
};

export type EventIngressContext =
  | {
      merchantId: string;
      ok: true;
      trustLevel: 'anonymous_client' | 'tenant_verified_client';
      verified: boolean;
    }
  | { code: 'merchant_context_error' | 'merchant_mismatch'; ok: false };

function normalizeHost(value: string | null): string {
  const host = value?.trim().toLowerCase() ?? '';
  if (host.startsWith('[')) return host.split(']')[0]?.slice(1) ?? '';
  return host.split(':')[0] ?? '';
}

function storefrontSlugFromHost(
  host: string,
  rootDomain: string
): string | null {
  const rootSuffix = `.${rootDomain}`;
  if (host.endsWith(rootSuffix)) {
    const candidate = host.slice(0, -rootSuffix.length);
    return candidate && !candidate.includes('.') ? candidate : null;
  }
  if (host.endsWith('.localhost')) {
    const candidate = host.slice(0, -'.localhost'.length);
    return candidate && !candidate.includes('.') ? candidate : null;
  }
  return null;
}

function customDomainFromHost(host: string, rootDomain: string): string | null {
  if (
    !host ||
    host === 'localhost' ||
    host === rootDomain ||
    host.endsWith(`.${rootDomain}`) ||
    host.endsWith('.localhost')
  ) {
    return null;
  }
  return host.startsWith('www.') ? host.slice(4) : host;
}

async function resolveSlug(
  supabase: SupabaseClient,
  slug: string
): Promise<string | null | undefined> {
  const { data, error } = await supabase
    .from('merchants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (error) return undefined;
  if (data?.id) return data.id;

  const { data: alias, error: aliasError } = await supabase
    .from('merchant_slug_aliases')
    .select('merchant_id')
    .eq('old_slug', slug)
    .maybeSingle();
  if (aliasError) return undefined;
  return alias?.merchant_id ?? null;
}

async function resolveDomain(
  supabase: SupabaseClient,
  domain: string
): Promise<string | null | undefined> {
  const { data, error } = await supabase
    .from('domains')
    .select('merchant_id')
    .eq('domain', domain)
    .eq('status', 'active')
    .maybeSingle();
  if (error) return undefined;
  return data?.merchant_id ?? null;
}

export async function resolveEventIngressContext({
  merchantId,
  request,
  supabase,
}: {
  merchantId: string;
  request: HeaderReader;
  supabase: SupabaseClient;
}): Promise<EventIngressContext> {
  const host = normalizeHost(request.headers.get('host'));
  const rootDomain = normalizeHost(
    process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com'
  );
  const slug = storefrontSlugFromHost(host, rootDomain);
  const domain = customDomainFromHost(host, rootDomain);

  let resolvedMerchantId: string | null | undefined = null;
  if (slug) {
    resolvedMerchantId = await resolveSlug(supabase, slug);
  } else if (domain) {
    resolvedMerchantId = await resolveDomain(supabase, domain);
  }

  if (resolvedMerchantId === undefined) {
    return { code: 'merchant_context_error', ok: false };
  }
  if (resolvedMerchantId && resolvedMerchantId !== merchantId) {
    return { code: 'merchant_mismatch', ok: false };
  }
  if (resolvedMerchantId) {
    return {
      merchantId: resolvedMerchantId,
      ok: true,
      trustLevel: 'tenant_verified_client',
      verified: true,
    };
  }

  return {
    merchantId,
    ok: true,
    trustLevel: 'anonymous_client',
    verified: false,
  };
}
