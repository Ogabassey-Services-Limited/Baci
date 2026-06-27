import type { NextRequest } from 'next/server';
import { redirectLegacyStorefrontSwap } from '@/lib/legacy-storefront-swap-redirect';

interface LegacyStorefrontSwapRouteContext {
  params: Promise<{
    slug: string;
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: LegacyStorefrontSwapRouteContext
) {
  const { slug } = await params;
  return redirectLegacyStorefrontSwap(request, slug);
}

export const HEAD = GET;
