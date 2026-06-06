import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  AGENT_READINESS_CACHE_CONTROL,
  BACI_AGENT_SKILL_DESCRIPTION,
  BACI_AGENT_SKILL_MARKDOWN,
  BACI_AGENT_SKILL_PATH,
} from '@/config/agent-readiness';

export const runtime = 'nodejs';

const SKILL_MARKDOWN_DIGEST = createHash('sha256')
  .update(BACI_AGENT_SKILL_MARKDOWN)
  .digest('hex');

export function GET(): NextResponse {
  return NextResponse.json(
    {
      $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
      skills: [
        {
          name: 'baci-storefront',
          type: 'skill-md',
          description: BACI_AGENT_SKILL_DESCRIPTION,
          url: BACI_AGENT_SKILL_PATH,
          digest: `sha256:${SKILL_MARKDOWN_DIGEST}`,
        },
      ],
    },
    {
      headers: {
        'Cache-Control': AGENT_READINESS_CACHE_CONTROL,
      },
    }
  );
}
