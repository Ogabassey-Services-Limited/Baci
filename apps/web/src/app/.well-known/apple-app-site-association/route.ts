import { type NextRequest, NextResponse } from 'next/server';

import { buildAASA, getAppConfigForDomain } from '@/lib/well-known';

const ROOT_DOMAIN =
  process.env.NEXT_PUBLIC_ROOT_DOMAIN?.split('\n')[0].trim() || 'usebaci.com';

/**
 * Apple Universal Links verification endpoint (AASA).
 * Returns per-domain app association using the modern "components"
 * format. Must NOT redirect — Apple rejects 3xx for AASA.
 * Must return Content-Type: application/json.
 */
export function GET(request: NextRequest): NextResponse {
  const hostname = request.nextUrl.hostname.toLowerCase();

  const config = getAppConfigForDomain(hostname, ROOT_DOMAIN);
  const aasa = buildAASA(config);

  return NextResponse.json(aasa, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      Vary: 'Host',
    },
  });
}
