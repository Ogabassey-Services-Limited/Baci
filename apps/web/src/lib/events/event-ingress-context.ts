import type { SupabaseClient } from '@supabase/supabase-js';

type HeaderReader = {
  headers: { get(name: string): string | null };
  url?: string;
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

function storefrontSlugFromPath(
  pageUrl: string | undefined,
  host: string,
  rootDomain: string
): string | null {
  if (!pageUrl || (host !== rootDomain && host !== `www.${rootDomain}`)) {
    return null;
  }
  try {
    const url = new URL(pageUrl);
    if (normalizeHost(url.host) !== host) return null;
    const [segment] = url.pathname.split('/').filter(Boolean);
    return segment &&
      segment !== 'api' &&
      /^[a-z0-9][a-z0-9-]{0,99}$/i.test(segment)
      ? segment
      : null;
  } catch {
    return null;
  }
}

export async function resolveEventIngressContext({
  merchantId,
  pageUrl,
  request,
  supabase,
}: {
  merchantId?: string;
  pageUrl?: string;
  request: HeaderReader;
  supabase: SupabaseClient;
}): Promise<EventIngressContext> {
  const host = normalizeHost(request.headers.get('host'));
  const rootDomain = normalizeHost(
    process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com'
  );
  const slug =
    storefrontSlugFromHost(host, rootDomain) ??
    storefrontSlugFromPath(
      pageUrl ?? request.headers.get('referer') ?? undefined,
      host,
      rootDomain
    );
  const domain = customDomainFromHost(host, rootDomain);

  let resolvedMerchantId: string | null | undefined = null;
  if (slug) {
    resolvedMerchantId = await resolveSlug(supabase, slug);
  } else if (domain) {
    resolvedMerchantId = await resolveDomain(supabase, domain);
    // Some merchants store `www.example.com` rather than the apex domain.
    if (!resolvedMerchantId && host.startsWith('www.')) {
      resolvedMerchantId = await resolveDomain(supabase, host);
    }
  }

  if (resolvedMerchantId === undefined) {
    return { code: 'merchant_context_error', ok: false };
  }
  if (resolvedMerchantId && merchantId && resolvedMerchantId !== merchantId) {
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

  if (!merchantId) {
    return { code: 'merchant_mismatch', ok: false };
  }
  return {
    merchantId,
    ok: true,
    trustLevel: 'anonymous_client',
    verified: false,
  };
}
