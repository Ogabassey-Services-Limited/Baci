#!/usr/bin/env node

const DEFAULT_HEALTH_URL = 'https://mcp.ogabassey.com/health';
const DEFAULT_MCP_URL = 'https://mcp.ogabassey.com/mcp';
const DEFAULT_REQUIRED_TOOLS = [
  'browse_categories',
  'cancel_agentic_checkout_session',
  'create_agentic_checkout_session',
  'create_cart_link',
  'get_agentic_checkout_session',
  'get_brands',
  'get_product',
  'get_product_variants',
  'get_recommendations',
  'get_shipping_quote',
  'get_store_info',
  'render_products_widget',
  'search_products',
  'update_agentic_checkout_session',
];

const timeoutMs = Number(process.env.MCP_SMOKE_TIMEOUT_MS ?? 15000);
const healthUrl = process.env.MCP_HEALTH_URL || DEFAULT_HEALTH_URL;
const mcpUrl = process.env.MCP_SMOKE_URL || DEFAULT_MCP_URL;
const requiredTools = parseRequiredTools(
  process.env.MCP_REQUIRED_TOOLS,
  DEFAULT_REQUIRED_TOOLS
);

async function main() {
  await assertHealthy(healthUrl);
  const tools = await listTools(mcpUrl);
  const toolNames = tools.map((tool) => tool.name).sort();
  const missingTools = requiredTools.filter((tool) => !toolNames.includes(tool));

  if (missingTools.length > 0) {
    throw new Error(
      [
        `MCP production smoke failed for ${mcpUrl}.`,
        `Missing tools: ${missingTools.join(', ')}`,
        `Live tools: ${toolNames.join(', ')}`,
      ].join('\n')
    );
  }

  console.log(
    `MCP production smoke passed for ${mcpUrl}: ${toolNames.length} tools`
  );
  console.log(`Verified tools: ${requiredTools.join(', ')}`);
}

async function assertHealthy(url) {
  const response = await fetchWithTimeout(url, {
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`MCP health check failed for ${url}: HTTP ${response.status}`);
  }

  const body = await response.json();
  if (body?.status !== 'healthy') {
    throw new Error(
      `MCP health check returned non-healthy status: ${JSON.stringify(body)}`
    );
  }
}

async function listTools(url) {
  const response = await fetchWithTimeout(url, {
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {},
    }),
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`MCP tools/list failed for ${url}: HTTP ${response.status}`);
  }

  const body = await response.json();
  if (body.error) {
    throw new Error(`MCP tools/list returned error: ${JSON.stringify(body.error)}`);
  }

  const tools = body?.result?.tools;
  if (!Array.isArray(tools)) {
    throw new Error(`MCP tools/list returned an invalid body: ${JSON.stringify(body)}`);
  }

  return tools.filter(
    (tool) => tool && typeof tool === 'object' && typeof tool.name === 'string'
  );
}

async function fetchWithTimeout(url, init) {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

function parseRequiredTools(value, fallback) {
  if (!value) return fallback;

  const parsed = value
    .split(',')
    .map((tool) => tool.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : fallback;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
