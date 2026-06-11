import { NextResponse } from 'next/server';
import { OGABASSEY_MERCHANT_ID } from '@/config/ogabassey';
import {
  getCachedProductLcpHint,
  sanitizeLookupLogValue,
} from '@/lib/cached-data';
import { getCachedProductLcpHintPrimaryImage } from '@/lib/cached-product-lcp-hint-primary-image';
import imageLoader from '@/lib/image-loader';
import { ogabasseyPdpLcpImageRequestSchema } from '@/schemas/ogabassey-pdp-lcp-image';

const PRELOAD_REDIRECT_CACHE_CONTROL =
  'public, max-age=300, s-maxage=300, stale-while-revalidate=86400';
const PRELOAD_MISS_CACHE_CONTROL = 'public, max-age=60, s-maxage=60';

type OgabasseyPdpLcpImageResponseInput = {
  productSlug: string;
  quality: number | string | null;
  width: number | string | null;
};

export async function buildOgabasseyPdpLcpImageResponse({
  productSlug,
  quality,
  width,
}: OgabasseyPdpLcpImageResponseInput): Promise<NextResponse> {
  const parsed = ogabasseyPdpLcpImageRequestSchema.safeParse({
    productSlug,
    quality,
    width,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid product image preload request' },
      { status: 400 }
    );
  }

  let cachedProduct: Awaited<ReturnType<typeof getCachedProductLcpHint>>;
  try {
    cachedProduct = await getCachedProductLcpHint(
      OGABASSEY_MERCHANT_ID,
      parsed.data.productSlug
    );
  } catch (error) {
    console.warn(
      'Unable to resolve OgaBassey PDP LCP preload image:',
      sanitizeLookupLogValue(parsed.data.productSlug),
      error
    );
    return new NextResponse(null, {
      headers: {
        'Cache-Control': PRELOAD_MISS_CACHE_CONTROL,
      },
      status: 500,
    });
  }

  if (!cachedProduct) {
    return new NextResponse(null, {
      headers: {
        'Cache-Control': PRELOAD_MISS_CACHE_CONTROL,
      },
      status: 404,
    });
  }

  const primaryImage = getCachedProductLcpHintPrimaryImage(cachedProduct);

  if (!primaryImage) {
    return new NextResponse(null, {
      headers: {
        'Cache-Control': PRELOAD_MISS_CACHE_CONTROL,
      },
      status: 404,
    });
  }

  const preloadUrl = imageLoader({
    quality: parsed.data.quality,
    src: primaryImage,
    width: parsed.data.width,
  });

  return NextResponse.redirect(preloadUrl, {
    headers: {
      'Cache-Control': PRELOAD_REDIRECT_CACHE_CONTROL,
    },
    status: 307,
  });
}
