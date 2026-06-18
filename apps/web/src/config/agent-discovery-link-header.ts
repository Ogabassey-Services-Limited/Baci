export const OGABASSEY_AGENT_DISCOVERY_LINK_HEADER = [
  '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
  '</.well-known/agent-skills/index.json>; rel="service-meta"; type="application/json"',
  '</.well-known/mcp/server-card.json>; rel="service-desc"; type="application/json"',
  '</openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json"',
  '</auth.md>; rel="service-doc"; type="text/markdown"',
].join(', ');
