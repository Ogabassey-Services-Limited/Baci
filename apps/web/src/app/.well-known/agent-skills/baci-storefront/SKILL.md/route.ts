import {
  AGENT_READINESS_CACHE_CONTROL,
  buildAgentSkillMarkdown,
} from '@/config/agent-readiness';
import { buildRequestBaseUrl } from '@/lib/storefront-host';

export const runtime = 'nodejs';

export function GET(request: Request): Response {
  return new Response(buildAgentSkillMarkdown(buildRequestBaseUrl(request)), {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': AGENT_READINESS_CACHE_CONTROL,
      'Vercel-CDN-Cache-Control': 'no-store',
      'X-Robots-Tag': 'noarchive',
    },
  });
}
