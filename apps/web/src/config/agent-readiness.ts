export const AGENT_READINESS_CACHE_CONTROL =
  'public, max-age=3600, s-maxage=3600';

export const AGENT_CONTENT_SIGNAL_DIRECTIVE =
  'Content-Signal: ai-train=no, search=yes, ai-input=yes';

export const BACI_AGENT_SKILL_DESCRIPTION =
  'Use Ogabassey storefront agent-commerce, catalog, and MCP discovery safely.';

export const BACI_AGENT_SKILL_PATH =
  '/.well-known/agent-skills/baci-storefront/SKILL.md';

function readTrimmedEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

const OGABASSEY_ORIGIN =
  readTrimmedEnv('OGABASSEY_AGENT_ORIGIN') ?? 'https://ogabassey.com';
const DEFAULT_MCP_ORIGIN = 'https://mcp.ogabassey.com';

export const BACI_MCP_SERVER_URL =
  readTrimmedEnv('MCP_PUBLIC_SERVER_URL', 'NEXT_PUBLIC_MCP_SERVER_URL') ??
  `${DEFAULT_MCP_ORIGIN}/mcp`;
export const BACI_MCP_HEALTH_URL =
  readTrimmedEnv('MCP_PUBLIC_HEALTH_URL', 'NEXT_PUBLIC_MCP_HEALTH_URL') ??
  `${DEFAULT_MCP_ORIGIN}/health`;

export const OGABASSEY_AGENT_DISCOVERY_LINK_HEADER = [
  '<https://cdn.ogabassey.com>; rel=preconnect',
  '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
  '</.well-known/agent-skills/index.json>; rel="service-meta"; type="application/json"',
  '</.well-known/mcp/server-card.json>; rel="service-desc"; type="application/json"',
  '</openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json"',
  '</auth.md>; rel="service-doc"; type="text/markdown"',
].join(', ');

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '') || OGABASSEY_ORIGIN;
}

export function buildAgentSkillMarkdown(baseUrl: string): string {
  const storefrontOrigin = normalizeBaseUrl(baseUrl);
  const llmGuideUrl = `${storefrontOrigin}/llms.txt`;
  const llmFullGuideUrl = `${storefrontOrigin}/llms-full.txt`;
  const ucpProfileUrl = `${storefrontOrigin}/.well-known/ucp`;
  const acpProfileUrl = `${storefrontOrigin}/.well-known/acp.json`;
  const agentCommerceUrl = `${storefrontOrigin}/agent-commerce.json`;
  const openApiUrl = `${storefrontOrigin}/openapi.json`;

  return `---
name: baci-storefront
description: ${BACI_AGENT_SKILL_DESCRIPTION}
---

# Baci Storefront Agent Skill

Use this skill when helping a user browse, compare, or buy from Ogabassey, a Baci-powered storefront.

## Discovery

- Storefront origin: ${storefrontOrigin}
- LLM guide: ${llmGuideUrl}
- Full LLM guide: ${llmFullGuideUrl}
- UCP profile: ${ucpProfileUrl}
- ACP profile: ${acpProfileUrl}
- Agent commerce manifest: ${agentCommerceUrl}
- OpenAPI description: ${openApiUrl}
- MCP server: ${BACI_MCP_SERVER_URL}

## Safety

- Read catalog, product, policy, and order-status information before taking actions.
- Do not submit checkout, payment, account, or wallet actions unless the user explicitly asks.
- Treat signed checkout routes as stateful and follow the request-signing contract in agent-commerce.json.
- Use the current storefront host as canonical when resolving product, cart, and checkout URLs.

## Useful MCP Tools

- search_products: search product names, categories, brands, and price ranges.
- get_product: fetch detailed product information and variants.
- get_shipping_quote: estimate delivery options for a destination.
- create_agentic_checkout_session: create a signed checkout session only after user confirmation.
- check_order: look up order status from an order number or phone number supplied by the user.
`;
}

export const BACI_AGENT_SKILL_MARKDOWN =
  buildAgentSkillMarkdown(OGABASSEY_ORIGIN);
