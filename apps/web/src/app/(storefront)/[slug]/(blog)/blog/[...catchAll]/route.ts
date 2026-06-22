import { type NextRequest, NextResponse } from 'next/server';
import { resolveBlogCatchAllOutcome } from './blog-catch-all-resolution';

// Co-locate with the Supabase primary (eu-west-1 / Dublin) — route handlers
// and sibling layouts do not inherit the [slug] layout preferredRegion.
export const preferredRegion = 'dub1';

interface RouteContext {
  params: Promise<{ slug: string; catchAll: string[] }>;
}

function notFoundResponse() {
  return new NextResponse('Not Found', {
    headers: {
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
    status: 404,
  });
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const outcome = await resolveBlogCatchAllOutcome({ params });

  if (outcome.type === 'redirect') {
    return NextResponse.redirect(
      new URL(outcome.url, request.url),
      outcome.status
    );
  }

  return notFoundResponse();
}

export async function HEAD(request: NextRequest, context: RouteContext) {
  const response = await GET(request, context);

  return new NextResponse(null, {
    headers: response.headers,
    status: response.status,
  });
}
