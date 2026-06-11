import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { buildOgabasseyPdpLcpImageResponse } from '@/lib/ogabassey-pdp-lcp-image-response';
import { ogabasseyPdpLcpImageProfileSchema } from '@/schemas/ogabassey-pdp-lcp-image';

const PRELOAD_PROFILE_TRANSFORMS = {
  desktop: {
    quality: 35,
    width: 640,
  },
  mobile: {
    quality: 30,
    width: 750,
  },
} as const;

type PdpLcpImageProfileRouteContext = {
  params: Promise<{
    productSlug: string;
    profile: string;
  }>;
};

export async function GET(
  _request: NextRequest,
  context: PdpLcpImageProfileRouteContext
) {
  const { productSlug, profile } = await context.params;
  const parsedProfile = ogabasseyPdpLcpImageProfileSchema.safeParse(profile);

  if (!parsedProfile.success) {
    return NextResponse.json(
      { error: 'Invalid product image preload profile' },
      { status: 400 }
    );
  }

  const transform = getPreloadProfileTransform(parsedProfile.data);

  return buildOgabasseyPdpLcpImageResponse({
    productSlug,
    quality: transform.quality,
    width: transform.width,
  });
}

function getPreloadProfileTransform(profile: 'mobile' | 'desktop') {
  return PRELOAD_PROFILE_TRANSFORMS[profile];
}
