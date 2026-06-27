import { type NextRequest, NextResponse } from 'next/server';
import { isValidMerchantSlug } from '@/lib/validation';

const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com')
  .trim()
  .replace(/[\r\n]/g, '')
  .toLowerCase();

export function redirectLegacyStorefrontSwap(
  request: NextRequest,
  slug: string
) {
  if (!isValidMerchantSlug(slug)) {
    return NextResponse.json(
      { error: 'Invalid storefront slug' },
      { status: 400 }
    );
  }

  const normalizedSlug = slug.trim().toLowerCase();
  const hostname = normalizeHostname(request.nextUrl.hostname);
  const redirectUrl = request.nextUrl.clone();

  redirectUrl.pathname = isMerchantScopedHost(hostname)
    ? '/swap'
    : `/${normalizedSlug}/swap`;

  return NextResponse.redirect(redirectUrl, 308);
}

function normalizeHostname(hostname: string): string {
  return hostname.split(':')[0].toLowerCase();
}

function isMerchantScopedHost(hostname: string): boolean {
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === ROOT_DOMAIN ||
    hostname === `www.${ROOT_DOMAIN}` ||
    hostname.endsWith('.vercel.app')
  ) {
    return false;
  }

  return true;
}
