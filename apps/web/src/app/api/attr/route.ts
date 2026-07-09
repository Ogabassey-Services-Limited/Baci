import { type NextRequest, NextResponse } from 'next/server';
import { generateClickIdCookies } from '@/lib/ad-tracking-cookies';
import { attrCaptureSchema } from '@/schemas/attr-capture';

// This response MUST never be cached. Cloudflare strips `Set-Cookie` from any
// cacheable response (the exact failure PR-ATTR fixes for storefront documents),
// so a cached `/api/attr` would silently drop the attribution cookie again.
// The browser uses POST for this endpoint so Cloudflare cache-everything
// document rules cannot cache the Set-Cookie response. The `no-store` header is
// still emitted for intermediary and browser caches that do honor origin policy.
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' } as const;

/**
 * POST /api/attr with an x-www-form-urlencoded body: gclid=…&fbclid=…
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
 * cookies. POST is intentional: Cloudflare cache rules apply to cacheable
 * GET/HEAD responses, so a same-origin POST keeps Set-Cookie off the document
 * cache path entirely while still passing the proxy Origin gate. Inputs are
 * validated hard (known params only, length-capped, URL-safe charset) and never
 * reflected in the response body (204, empty).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.text();
  const params = Object.fromEntries(new URLSearchParams(body).entries());
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
