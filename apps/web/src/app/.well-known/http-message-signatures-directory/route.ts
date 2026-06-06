import { NextResponse } from 'next/server';
import { env } from '@/env';
import { buildWebBotAuthDirectoryResponse } from '@/lib/agentic/web-bot-auth-directory';

export function GET(request: Request): Response {
  const requestHost = request.headers.get('host') ?? new URL(request.url).host;
  const authority = requestHost.split(':')[0].toLowerCase();
  const response = buildWebBotAuthDirectoryResponse({
    authority,
    privateKeyPem: env.WEB_BOT_AUTH_PRIVATE_KEY_PEM,
    publicJwksJson: env.WEB_BOT_AUTH_PUBLIC_JWKS_JSON,
  });

  if (response) return response;

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
