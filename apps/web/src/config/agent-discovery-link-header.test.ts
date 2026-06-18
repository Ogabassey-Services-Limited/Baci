import { describe, expect, it } from 'vitest';
import { OGABASSEY_AGENT_DISCOVERY_LINK_HEADER } from './agent-discovery-link-header';

const EXPECTED_AGENT_DISCOVERY_LINK_ENTRIES = [
  '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
  '</.well-known/agent-skills/index.json>; rel="service-meta"; type="application/json"',
  '</.well-known/mcp/server-card.json>; rel="service-desc"; type="application/json"',
  '</openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json"',
  '</auth.md>; rel="service-doc"; type="text/markdown"',
] as const;

describe('agent discovery Link header', () => {
  it('preserves ordered agent discovery resources and MIME types', () => {
    const entries = OGABASSEY_AGENT_DISCOVERY_LINK_HEADER.split(', ');

    expect(entries).toEqual(EXPECTED_AGENT_DISCOVERY_LINK_ENTRIES);
    expect(OGABASSEY_AGENT_DISCOVERY_LINK_HEADER).toBe(
      EXPECTED_AGENT_DISCOVERY_LINK_ENTRIES.join(', ')
    );
    for (const entry of entries) {
      expect(entry).toMatch(
        /^<[^>]+>; rel=(?:"[a-z-]+"|[a-z-]+)(?:; type="[-+.a-z0-9/]+")?$/
      );
    }
  });
});
