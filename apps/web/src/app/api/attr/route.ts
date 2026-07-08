import { type NextRequest, NextResponse } from 'next/server';
import { generateClickIdCookies } from '@/lib/ad-tracking-cookies';
import { attrCaptureSchema } from '@/schemas/attr-capture';

// This response MUST never be cached. Cloudflare strips `Set-Cookie` from any
// cacheable response (the exact failure PR-ATTR fixes for storefront documents),
// so a cached `/api/attr` would silently drop the attribution cookie again.
// `force-dynamic` keeps it off Vercel's edge; the `no-store` header below keeps
// it off Cloudflare's.
export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' } as const;

/**
 * GET /api/attr?gclid=…&fbclid=…&ttclid=…&sccid=…
 *
 * Client-side ad-click capture (PR-ATTR). The early inline head script on
 * storefront pages forwards the click IDs found in `location.search` here, and
 * this handler replies with the same `baci_*` cookies the middleware used to set
 * (identical names, 90-day window, SameSite=Lax; Secure) — but as an HTTP
 * `Set-Cookie` the browser is guaranteed to receive even on a Cloudflare cache
 * HIT. Server-set cookies are also exempt from Safari ITP's 24h/7d cap on
 * script-written cookies, which is why the browser never calls
 * `document.cookie` for these.
 *
 * Public + idempotent by design: anonymous ad-landing visitors, no auth, no DB
 * access, no server-state mutation — it only echoes validated click IDs back as
 * cookies. GET is intentional: `navigator.sendBeacon` is POST-only and would
 * trip the proxy's CSRF/Origin gate on non-GET `/api` requests, whereas an
 * idempotent cookie set is acceptable GET semantics. Inputs are validated hard
 * (known params only, length-capped, URL-safe charset) and never reflected in
 * the response body (204, empty).
 */
export function GET(request: NextRequest): NextResponse {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = attrCaptureSchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid attribution parameters' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const response = new NextResponse(null, {
    status: 204,
    headers: NO_STORE_HEADERS,
  });

  for (const cookie of generateClickIdCookies(parsed.data)) {
    response.headers.append('Set-Cookie', cookie);
  }

  return response;
}
