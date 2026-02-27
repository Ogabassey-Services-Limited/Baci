import { type NextRequest, NextResponse } from 'next/server';

import { buildAssetLinks, getAppConfigForDomain } from '@/lib/well-known';

export const dynamic = 'force-dynamic';

const ROOT_DOMAIN = (
  process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com'
).trim();

/**
 * Android App Links verification endpoint.
 * Returns per-domain Digital Asset Links statements so Android
 * only associates the correct app with each merchant's domain.
 * Must NOT redirect — Android rejects 3xx responses.
 */
export function GET(request: NextRequest): NextResponse {
  const host = request.headers.get('host') || '';
  const hostname = host.split(':')[0];

  const config = getAppConfigForDomain(hostname, ROOT_DOMAIN);
  const statements = buildAssetLinks(config);

  return NextResponse.json(statements, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
