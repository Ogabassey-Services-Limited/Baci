import { NextResponse } from 'next/server';
import { AGENT_READINESS_CACHE_CONTROL } from '@/config/agent-readiness';
import { env } from '@/env';
import { buildOAuthProtectedResourceMetadata } from '@/lib/agentic/oauth-protected-resource-metadata';
import { buildRequestBaseUrl } from '@/lib/storefront-host';

export function GET(request: Request): NextResponse {
  return NextResponse.json(
    buildOAuthProtectedResourceMetadata({
      baseUrl: buildRequestBaseUrl(request),
      supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    }),
    {
      headers: {
        'Cache-Control': AGENT_READINESS_CACHE_CONTROL,
        'Vercel-CDN-Cache-Control': 'no-store',
      },
    }
  );
}
