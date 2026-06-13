import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  OGABASSEY_PDP_PRIMARY_IMAGE_DESKTOP_PRELOAD_WIDTH,
  OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_HEADER_PRELOAD_WIDTH,
  OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_PRELOAD_WIDTH,
  OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_QUALITY,
  OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
} from '@/components/storefront/ogabassey/config/product-media';
import { buildOgabasseyPdpLcpImageResponse } from '@/lib/ogabassey-pdp-lcp-image-response';
import {
  type OgabasseyPdpLcpImageProfile,
  ogabasseyPdpLcpImageProfileSchema,
} from '@/schemas/ogabassey-pdp-lcp-image';

const PRELOAD_PROFILE_TRANSFORMS = {
  desktop: {
    quality: OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
    width: OGABASSEY_PDP_PRIMARY_IMAGE_DESKTOP_PRELOAD_WIDTH,
  },
  mobile: {
    quality: OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_QUALITY,
    width: OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_PRELOAD_WIDTH,
  },
  'mobile-header': {
    quality: OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
    width: OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_HEADER_PRELOAD_WIDTH,
  },
} as const;

type PdpLcpImageProfileRouteContext = {
  params: Promise<{
    productSlug: string;
    profile: string;
  }>;
};

export async function GET(
  request: NextRequest,
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
    accept: request.headers.get('accept'),
  });
}

function getPreloadProfileTransform(profile: OgabasseyPdpLcpImageProfile) {
  return PRELOAD_PROFILE_TRANSFORMS[profile];
}
