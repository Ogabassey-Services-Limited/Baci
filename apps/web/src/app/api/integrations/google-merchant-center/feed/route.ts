import { type NextRequest, NextResponse } from 'next/server';
import {
  MerchantNotFoundError,
  resolveFeedMerchant,
} from '@/lib/feed-identifier';
import { createAnonClient } from '@/lib/supabase/anon';

const DEFAULT_ROOT_DOMAIN = 'usebaci.com';

function normalizeHost(rawHost: string | null): string | null {
  if (!rawHost) {
    return null;
  }

  const firstHost = rawHost.split(',')[0]?.trim().toLowerCase();
  if (!firstHost) {
    return null;
  }

  return firstHost.replace(/:\d+$/, '');
}

function normalizeProtocol(rawProtocol: string | null): string {
  if (!rawProtocol) {
    return 'https';
  }

  const firstProtocol = rawProtocol
    .split(',')[0]
    ?.trim()
    .toLowerCase()
    .replace(/:$/, '');
  return firstProtocol === 'http' ? 'http' : 'https';
}

function getManagedMerchantSlug(host: string): string | null {
  const rootDomain = (
    process.env.NEXT_PUBLIC_ROOT_DOMAIN || DEFAULT_ROOT_DOMAIN
  ).toLowerCase();

  if (host === rootDomain || host === `www.${rootDomain}`) {
    return null;
  }

  if (!host.endsWith(`.${rootDomain}`)) {
    return null;
  }

  const candidate = host.slice(0, -`.${rootDomain}`.length);
  return candidate && !candidate.includes('.') ? candidate : null;
}

async function resolveLegacyMerchantSlug(host: string): Promise<string> {
  const managedSlug = getManagedMerchantSlug(host);
  if (managedSlug) {
    return managedSlug;
  }

  const supabase = createAnonClient();
  const { data: domain, error } = await supabase
    .from('domains')
    .select('merchant_id')
    .eq('domain', host)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    throw new Error('Failed to resolve merchant domain', { cause: error });
  }

  if (!domain?.merchant_id) {
    throw new MerchantNotFoundError(host);
  }

  const merchant = await resolveFeedMerchant(domain.merchant_id, false);
  return merchant.slug;
}

/**
 * Legacy Google Merchant feed route.
 * Redirects old integrations to the canonical public feed endpoint.
 */
export async function GET(request: NextRequest) {
  const host = normalizeHost(
    request.headers.get('x-forwarded-host') ??
      request.headers.get('host') ??
      new URL(request.url).host
  );
  const protocol = normalizeProtocol(
    request.headers.get('x-forwarded-proto') ?? new URL(request.url).protocol
  );

  if (!host) {
    return NextResponse.json(
      { error: 'Unable to resolve merchant for legacy feed URL' },
      { status: 400 }
    );
  }

  try {
    const merchantSlug = await resolveLegacyMerchantSlug(host);
    const redirectUrl = new URL(request.url);
    redirectUrl.protocol = `${protocol}:`;
    redirectUrl.host = host;
    redirectUrl.pathname = '/api/feed/google-merchant';
    redirectUrl.search = '';
    redirectUrl.searchParams.set('merchant_slug', merchantSlug);

    return NextResponse.redirect(redirectUrl, 308);
  } catch (error) {
    console.error('LEGACY_GMC_FEED_REDIRECT_ERROR:', error);

    if (error instanceof MerchantNotFoundError) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to resolve merchant for legacy feed URL' },
      { status: 500 }
    );
  }
}
