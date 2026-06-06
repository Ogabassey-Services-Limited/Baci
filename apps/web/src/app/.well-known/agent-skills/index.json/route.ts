import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  AGENT_READINESS_CACHE_CONTROL,
  BACI_AGENT_SKILL_DESCRIPTION,
  BACI_AGENT_SKILL_PATH,
  buildAgentSkillMarkdown,
} from '@/config/agent-readiness';
import { buildRequestBaseUrl } from '@/lib/storefront-host';

export const runtime = 'nodejs';

export function GET(request: Request): NextResponse {
  const skillMarkdownDigest = createHash('sha256')
    .update(buildAgentSkillMarkdown(buildRequestBaseUrl(request)))
    .digest('hex');

  return NextResponse.json(
    {
      $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
      skills: [
        {
          name: 'baci-storefront',
          type: 'skill-md',
          description: BACI_AGENT_SKILL_DESCRIPTION,
          url: BACI_AGENT_SKILL_PATH,
          digest: `sha256:${skillMarkdownDigest}`,
        },
      ],
    },
    {
      headers: {
        'Cache-Control': AGENT_READINESS_CACHE_CONTROL,
        'Vercel-CDN-Cache-Control': 'no-store',
      },
    }
  );
}
