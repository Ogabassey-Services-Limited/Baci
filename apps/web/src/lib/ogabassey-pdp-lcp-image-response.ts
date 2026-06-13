import { NextResponse } from 'next/server';
import { OGABASSEY_MERCHANT_ID } from '@/config/ogabassey';
import { getBaciCdnOriginFetchSecret } from '@/env';
import {
  getCachedProductLcpHint,
  sanitizeLookupLogValue,
} from '@/lib/cached-data';
import { getCachedProductLcpHintPrimaryImage } from '@/lib/cached-product-lcp-hint-primary-image';
import imageLoader from '@/lib/image-loader';
import { ogabasseyPdpLcpImageRequestSchema } from '@/schemas/ogabassey-pdp-lcp-image';

const PRELOAD_IMAGE_CACHE_CONTROL =
  'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400';
const PRELOAD_MISS_CACHE_CONTROL = 'public, max-age=60, s-maxage=60';
const DEFAULT_IMAGE_ACCEPT_HEADER = 'image/avif,image/webp,image/*,*/*;q=0.8';
const ORIGIN_FETCH_SECRET_HEADER = 'x-baci-origin-fetch';

type OgabasseyPdpLcpImageResponseInput = {
  accept?: string | null;
  productSlug: string;
  quality: number | string | null;
  width: number | string | null;
};

export async function buildOgabasseyPdpLcpImageResponse({
  accept,
  productSlug,
  quality,
  width,
}: OgabasseyPdpLcpImageResponseInput): Promise<Response> {
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

  let imageResponse: Response;
  try {
    const fetchHeaders = new Headers({
      Accept: accept || DEFAULT_IMAGE_ACCEPT_HEADER,
    });
    const originFetchSecret = getBaciCdnOriginFetchSecret();

    if (originFetchSecret) {
      fetchHeaders.set(ORIGIN_FETCH_SECRET_HEADER, originFetchSecret);
    }

    imageResponse = await fetch(preloadUrl, {
      headers: fetchHeaders,
    });
  } catch (error) {
    console.warn(
      'Unable to fetch transformed OgaBassey PDP LCP preload image:',
      sanitizeLookupLogValue(parsed.data.productSlug),
      error
    );
    return createFallbackRedirectResponse(preloadUrl);
  }

  if (!imageResponse.ok || !imageResponse.body) {
    console.warn(
      'Transformed OgaBassey PDP LCP preload image returned unusable response:',
      sanitizeLookupLogValue(parsed.data.productSlug),
      imageResponse.status
    );
    return createFallbackRedirectResponse(preloadUrl);
  }

  const headers = new Headers({
    'Cache-Control': PRELOAD_IMAGE_CACHE_CONTROL,
    'Content-Type':
      imageResponse.headers.get('content-type') ?? 'application/octet-stream',
    Vary: 'Accept',
  });
  const contentLength = imageResponse.headers.get('content-length');

  if (contentLength) {
    headers.set('Content-Length', contentLength);
  }

  return new Response(imageResponse.body, {
    headers,
    status: 200,
  });
}

function createFallbackRedirectResponse(preloadUrl: string): Response {
  return new Response(null, {
    headers: {
      'Cache-Control': PRELOAD_MISS_CACHE_CONTROL,
      Location: preloadUrl,
    },
    status: 307,
  });
}
