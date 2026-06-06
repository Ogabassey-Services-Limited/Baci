import { NextResponse } from 'next/server';
import {
  AGENT_READINESS_CACHE_CONTROL,
  BACI_MCP_HEALTH_URL,
} from '@/config/agent-readiness';
import { buildRequestBaseUrl } from '@/lib/storefront-host';

export function GET(request: Request): NextResponse {
  const baseUrl = buildRequestBaseUrl(request);
  const body = {
    linkset: [
      {
        anchor: new URL('/api/agentic', baseUrl).toString(),
        'service-desc': [
          {
            href: new URL('/openapi.json', baseUrl).toString(),
            type: 'application/vnd.oai.openapi+json',
          },
        ],
        'service-doc': [
          {
            href: new URL('/auth.md', baseUrl).toString(),
            type: 'text/markdown',
          },
        ],
        status: [
          {
            href: BACI_MCP_HEALTH_URL,
            type: 'application/json',
          },
        ],
      },
    ],
  };

  return NextResponse.json(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/linkset+json; charset=utf-8',
      'Cache-Control': AGENT_READINESS_CACHE_CONTROL,
      'Vercel-CDN-Cache-Control': 'no-store',
    },
  });
}
