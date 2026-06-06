// @vitest-environment node

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

describe('GET /.well-known/agent-skills/index.json', () => {
  it('publishes a v0.2.0 agent skills index with a valid skill digest', async () => {
    const [{ GET }, { GET: getSkill }] = await Promise.all([
      import('./route'),
      import('../baci-storefront/SKILL.md/route'),
    ]);

    const response = GET();
    const body = await response.json();
    const skillResponse = getSkill();
    const skillBody = await skillResponse.text();
    const digest = createHash('sha256').update(skillBody).digest('hex');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(body).toEqual({
      $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
      skills: [
        {
          name: 'baci-storefront',
          type: 'skill-md',
          description:
            'Use Ogabassey storefront agent-commerce, catalog, and MCP discovery safely.',
          url: '/.well-known/agent-skills/baci-storefront/SKILL.md',
          digest: `sha256:${digest}`,
        },
      ],
    });
    expect(response.headers.get('cache-control')).toContain('max-age=3600');
  });
});
