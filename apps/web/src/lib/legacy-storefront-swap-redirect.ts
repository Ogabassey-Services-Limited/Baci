import { type NextRequest, NextResponse } from 'next/server';
import { isValidMerchantSlug } from '@/lib/validation';

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
  const hostname = request.nextUrl.hostname.toLowerCase();
  const isOgabasseyCustomDomain =
    normalizedSlug === 'ogabassey' &&
    (hostname === 'ogabassey.com' || hostname === 'www.ogabassey.com');
  const redirectUrl = request.nextUrl.clone();

  redirectUrl.pathname = isOgabasseyCustomDomain
    ? '/swap'
    : `/${normalizedSlug}/swap`;

  return NextResponse.redirect(redirectUrl, 308);
}
