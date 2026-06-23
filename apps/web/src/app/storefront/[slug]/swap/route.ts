import { type NextRequest, NextResponse } from 'next/server';
import { isValidMerchantSlug } from '@/lib/validation';

interface LegacyStorefrontSwapRouteContext {
  params: Promise<{
    slug: string;
  }>;
}

function getLegacySwapRedirectUrl(request: NextRequest, slug: string): URL {
  const normalizedSlug = slug.trim().toLowerCase();
  const hostname = request.nextUrl.hostname.toLowerCase();
  const isOgabasseyCustomDomain =
    normalizedSlug === 'ogabassey' &&
    (hostname === 'ogabassey.com' || hostname === 'www.ogabassey.com');
  const redirectUrl = request.nextUrl.clone();

  redirectUrl.pathname = isOgabasseyCustomDomain
    ? '/swap'
    : `/${encodeURIComponent(normalizedSlug)}/swap`;

  return redirectUrl;
}

export async function GET(
  request: NextRequest,
  { params }: LegacyStorefrontSwapRouteContext
) {
  const { slug } = await params;
  if (!isValidMerchantSlug(slug)) {
    return NextResponse.json(
      { error: 'Invalid storefront slug' },
      { status: 400 }
    );
  }

  return NextResponse.redirect(getLegacySwapRedirectUrl(request, slug), 308);
}

export const HEAD = GET;
