import { type NextRequest, NextResponse } from 'next/server';

import { buildAssetLinks, getAppConfigForDomain } from '@/lib/well-known';

const ROOT_DOMAIN =
  process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim() || 'usebaci.com';

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
  const hostname = request.nextUrl.hostname.toLowerCase();

  const config = getAppConfigForDomain(hostname, ROOT_DOMAIN);
  const statements = buildAssetLinks(config);

  return NextResponse.json(statements, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
