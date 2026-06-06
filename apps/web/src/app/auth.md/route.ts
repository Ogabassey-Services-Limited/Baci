import { AGENT_READINESS_CACHE_CONTROL } from '@/config/agent-readiness';
import { buildRequestBaseUrl } from '@/lib/storefront-host';

function buildAuthMarkdown(baseUrl: string): string {
  return `# Ogabassey Agent Authentication

Ogabassey exposes public catalog and storefront discovery surfaces for agents.

## Public discovery

- Agent commerce manifest: ${baseUrl}/agent-commerce.json
- UCP profile: ${baseUrl}/.well-known/ucp
- ACP profile: ${baseUrl}/.well-known/acp.json
- OpenAPI description: ${baseUrl}/openapi.json
- MCP server card: ${baseUrl}/.well-known/mcp/server-card.json

## Authenticated actions

Signed checkout and order routes use the bearer_hmac contract described in
agent-commerce.json. Mutating checkout actions require explicit user intent,
request integrity headers, and idempotency keys.

OAuth registration is not currently published for Ogabassey. Agents should not
invent OAuth clients or request merchant/customer account access through browser
sessions.
`;
}

export function GET(request: Request): Response {
  return new Response(buildAuthMarkdown(buildRequestBaseUrl(request)), {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': AGENT_READINESS_CACHE_CONTROL,
      'Vercel-CDN-Cache-Control': 'no-store',
      'X-Robots-Tag': 'noarchive',
    },
  });
}
