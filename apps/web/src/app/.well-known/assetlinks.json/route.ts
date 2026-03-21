import { type NextRequest, NextResponse } from 'next/server';

import { buildAssetLinks, getAppConfigForDomain } from '@/lib/well-known';

const ROOT_DOMAIN =
  process.env.NEXT_PUBLIC_ROOT_DOMAIN?.split(/[\r\n]/)[0].trim() ||
  'usebaci.com';

/**
 * Android App Links verification endpoint.
 * Returns per-domain Digital Asset Links statements so Android
 * only associates the correct app with each merchant's domain.
 * This route must remain host-aware because storefront domains and
 * the root platform domain intentionally advertise different apps.
 * Keep this file under `apps/web/**` so deploy-path filtering still
 * catches App Links fixes that need a production rollout.
 * Must NOT redirect — Android rejects 3xx responses.
 */
export function GET(request: NextRequest): NextResponse {
  // Use Host header — request.nextUrl.hostname returns Vercel's internal
  // deployment hostname, not the custom domain the user is visiting.
  const hostHeader = request.headers.get('host') || '';
  const hostname = hostHeader.split(':')[0].toLowerCase();

  const config = getAppConfigForDomain(hostname, ROOT_DOMAIN);
  const statements = buildAssetLinks(config);

  return NextResponse.json(statements, {
    status: 200,
    headers: {
      // Short CDN TTL: Vercel doesn't vary cache by Host header, so a long
      // s-maxage would serve the wrong domain's response to all visitors.
      'Cache-Control': 'public, max-age=86400, s-maxage=60',
    },
  });
}
