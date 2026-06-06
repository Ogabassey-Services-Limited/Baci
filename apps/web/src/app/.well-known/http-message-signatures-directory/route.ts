import { NextResponse } from 'next/server';
import { env, getRootDomain } from '@/env';
import { buildWebBotAuthDirectoryResponse } from '@/lib/agentic/web-bot-auth-directory';
import { buildRequestBaseUrl, stripPort } from '@/lib/storefront-host';

const DEFAULT_ROOT_DOMAIN = 'usebaci.com';

function getAllowedWebBotAuthAuthority(request: Request): string | null {
  const authority = stripPort(new URL(buildRequestBaseUrl(request)).host);
  const rootDomain = (getRootDomain() || DEFAULT_ROOT_DOMAIN)
    .split(/[\r\n]/)[0]
    .trim()
    .toLowerCase();

  if (authority === rootDomain || authority === `www.${rootDomain}`) {
    return authority;
  }

  return null;
}

export function GET(request: Request): Response {
  const authority = getAllowedWebBotAuthAuthority(request);
  if (!authority) {
    return NextResponse.json(
      { error: 'Not found' },
      {
        status: 404,
        headers: {
          'Cache-Control': 'no-store',
          'Vercel-CDN-Cache-Control': 'no-store',
        },
      }
    );
  }

  const response = buildWebBotAuthDirectoryResponse({
    authority,
    privateKeyPem: env.WEB_BOT_AUTH_PRIVATE_KEY_PEM,
    publicJwksJson: env.WEB_BOT_AUTH_PUBLIC_JWKS_JSON,
  });

  if (response) {
    response.headers.set('Vercel-CDN-Cache-Control', 'no-store');

    return response;
  }

  return NextResponse.json(
    { error: 'Service unavailable: signing key not configured' },
    {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store',
      },
    }
  );
}
