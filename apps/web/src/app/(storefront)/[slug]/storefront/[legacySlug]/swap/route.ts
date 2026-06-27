import type { NextRequest } from 'next/server';
import { redirectLegacyStorefrontSwap } from '@/lib/legacy-storefront-swap-redirect';

interface RewrittenLegacyStorefrontSwapRouteContext {
  params: Promise<{
    legacySlug: string;
    slug: string;
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: RewrittenLegacyStorefrontSwapRouteContext
) {
  const { legacySlug } = await params;
  return redirectLegacyStorefrontSwap(request, legacySlug);
}

export const HEAD = GET;
