import {
  AGENT_READINESS_CACHE_CONTROL,
  BACI_AGENT_SKILL_MARKDOWN,
} from '@/config/agent-readiness';

export const runtime = 'nodejs';

export function GET(): Response {
  return new Response(BACI_AGENT_SKILL_MARKDOWN, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': AGENT_READINESS_CACHE_CONTROL,
      'X-Robots-Tag': 'noarchive',
    },
  });
}
