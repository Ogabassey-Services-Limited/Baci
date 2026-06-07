import { NextResponse } from 'next/server';
import { AGENT_READINESS_CACHE_CONTROL } from '@/config/agent-readiness';
import { buildAgentAuthAuthorizationServerMetadata } from '@/lib/agentic/agent-auth-authorization-server-metadata';
import { buildRequestBaseUrl } from '@/lib/storefront-host';

export function GET(request: Request): NextResponse {
  return NextResponse.json(
    buildAgentAuthAuthorizationServerMetadata(buildRequestBaseUrl(request)),
    {
      headers: {
        'Cache-Control': AGENT_READINESS_CACHE_CONTROL,
        'Vercel-CDN-Cache-Control': 'no-store',
      },
    }
  );
}
