import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { buildOgabasseyPdpLcpImageResponse } from '@/lib/ogabassey-pdp-lcp-image-response';
import { ogabasseyPdpLcpImageRequestSchema } from '@/schemas/ogabassey-pdp-lcp-image';

type PdpLcpImageRouteContext = {
  params: Promise<{
    productSlug: string;
  }>;
};

export async function GET(
  request: NextRequest,
  context: PdpLcpImageRouteContext
) {
  const { productSlug } = await context.params;
  const parsed = ogabasseyPdpLcpImageRequestSchema.safeParse({
    productSlug,
    quality: request.nextUrl.searchParams.get('quality'),
    width: request.nextUrl.searchParams.get('width'),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid product image preload request' },
      { status: 400 }
    );
  }

  return buildOgabasseyPdpLcpImageResponse(parsed.data);
}
