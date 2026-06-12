import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const testFileDirectory = dirname(fileURLToPath(import.meta.url));
const serverSource = readFileSync(
  join(testFileDirectory, 'server.ts'),
  'utf8'
);
const snippetStartMatch = /^\s*const\s+ESCAPE_HTML_MAP\s*=/m.exec(
  serverSource
);
const snippetStart = snippetStartMatch?.index ?? -1;
const snippetEndMatch =
  snippetStart === -1
    ? null
    : /^\s*const\s+openLink\s*=/m.exec(serverSource.slice(snippetStart));
const snippetEnd =
  snippetStart === -1 || snippetEndMatch === null
    ? -1
    : snippetStart + snippetEndMatch.index;

if (snippetStart === -1 || snippetEnd === -1) {
  throw new Error('Embedded escapeHtml snippet not found in MCP server widget');
}

const escapeHtmlSnippet = serverSource.slice(snippetStart, snippetEnd);
const webRootDirectory = dirname(testFileDirectory);
const repoRootDirectory = dirname(dirname(webRootDirectory));
const tsxExecutable = join(
  repoRootDirectory,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tsx.cmd' : 'tsx'
);

function runEmbeddedEscapeHtml(input: unknown) {
  const context: { input: unknown; result?: string } = { input };

  runInNewContext(
    `${escapeHtmlSnippet}\nglobalThis.result = escapeHtml(globalThis.input);`,
    context
  );

  return context.result;
}

describe('MCP widget HTML escaping', () => {
  it('escapes quotes for values interpolated into HTML attributes', () => {
    expect(
      runEmbeddedEscapeHtml('https://img.invalid/a.jpg" onerror="alert(1)')
    ).toBe('https://img.invalid/a.jpg&quot; onerror=&quot;alert(1)');
  });

  it('escapes text, tag, and apostrophe characters consistently', () => {
    expect(runEmbeddedEscapeHtml(`Tom & "Jerry" <tag> 'phone'`)).toBe(
      'Tom &amp; &quot;Jerry&quot; &lt;tag&gt; &#39;phone&#39;'
    );
  });

  it('keeps nullish values empty for existing widget call sites', () => {
    expect(runEmbeddedEscapeHtml(null)).toBe('');
  });
});

describe('MCP streamable HTTP probe compatibility', () => {
  let serverProcess: ReturnType<typeof spawn> | undefined;
  let serverBaseUrl: string;

  beforeAll(async () => {
    const server = await startMcpServer();
    serverProcess = server.process;
    serverBaseUrl = server.baseUrl;
  }, 15_000);

  afterAll(async () => {
    await stopMcpServer(serverProcess);
  });

  it('allows the MCP protocol version header in CORS preflights', async () => {
    const response = await fetch(`${serverBaseUrl}/mcp`, {
      method: 'OPTIONS',
      headers: {
        'access-control-request-headers':
          'content-type, mcp-protocol-version',
        'access-control-request-method': 'POST',
        origin: 'https://chatgpt.com',
      },
    });

    expect(response.status).toBe(204);
    expect(
      response.headers.get('access-control-allow-headers')?.toLowerCase()
    ).toContain('mcp-protocol-version');
  });

  it('responds to HEAD liveness checks on the MCP endpoint', async () => {
    const response = await fetch(`${serverBaseUrl}/mcp`, { method: 'HEAD' });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-methods')).toContain(
      'HEAD'
    );
  });

  it('publishes product_id and product_name lookup inputs for product detail tools', async () => {
    const payload = await postMcpJsonRpc(serverBaseUrl, {
      id: 1,
      method: 'tools/list',
      params: {},
    });
    const tools = getResultTools(payload);
    const productTools = ['get_product', 'get_product_variants'];

    for (const toolName of productTools) {
      const tool = tools.find((candidate) => candidate.name === toolName);
      expect(tool).toBeDefined();

      expect(tool?.inputSchema.properties.product_id).toMatchObject({
        type: 'string',
        minLength: 1,
        maxLength: 80,
      });
      expect(tool?.inputSchema.properties.product_name).toMatchObject({
        type: 'string',
        minLength: 1,
        maxLength: 100,
      });
    }
  });

  it('keeps the ChatGPT tool surface public-only unless private feature flags are enabled', async () => {
    const payload = await postMcpJsonRpc(serverBaseUrl, {
      id: 2,
      method: 'tools/list',
      params: {},
    });
    const toolNames = getResultTools(payload)
      .map((tool) => tool.name)
      .sort();

    expect(toolNames).toEqual([
      'add_to_cart',
      'browse_categories',
      'get_brands',
      'get_product',
      'get_product_variants',
      'get_recommendations',
      'get_shipping_quote',
      'get_store_info',
      'search_products',
    ]);
    expect(toolNames).not.toContain('check_order');
    expect(toolNames).not.toContain('check_payment_status');
    expect(toolNames).not.toContain('create_agentic_checkout_session');
    expect(toolNames).not.toContain('generate_payment_account');
    expect(toolNames).not.toContain('search_ucp_catalog');
  });

  it('exposes private agentic and payment tools when explicit feature flags are enabled', async () => {
    const flaggedServer = await startMcpServer({
      MCP_ENABLE_AGENTIC_CHECKOUT_TOOLS: '1',
      MCP_ENABLE_ORDER_PAYMENT_TOOLS: '1',
    });

    try {
      const payload = await postMcpJsonRpc(flaggedServer.baseUrl, {
        id: 3,
        method: 'tools/list',
        params: {},
      });
      const toolNames = getResultTools(payload).map((tool) => tool.name);

      expect(toolNames).toEqual(
        expect.arrayContaining([
          'cancel_agentic_checkout_session',
          'cancel_ucp_cart',
          'check_order',
          'check_payment_status',
          'complete_agentic_checkout_session',
          'convert_ucp_cart_to_checkout',
          'create_agentic_checkout_session',
          'create_ucp_cart',
          'generate_payment_account',
          'get_agentic_checkout_session',
          'get_ucp_cart',
          'lookup_ucp_catalog_items',
          'search_ucp_catalog',
          'update_agentic_checkout_session',
          'update_ucp_cart',
        ])
      );
    } finally {
      await stopMcpServer(flaggedServer.process);
    }
  });
});

interface JsonRpcResponse {
  result?: unknown;
}

interface McpToolDefinition {
  name: string;
  inputSchema: {
    properties: Record<string, unknown>;
  };
}

async function postMcpJsonRpc(
  serverBaseUrl: string,
  request: {
    id: number;
    method: string;
    params: Record<string, unknown>;
  }
): Promise<JsonRpcResponse> {
  const response = await fetch(`${serverBaseUrl}/mcp`, {
    method: 'POST',
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      'mcp-protocol-version': '2025-06-18',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      ...request,
    }),
  });

  expect(response.status).toBe(200);

  return (await response.json()) as JsonRpcResponse;
}

function getResultTools(payload: JsonRpcResponse): McpToolDefinition[] {
  const result = payload.result;
  if (!result || typeof result !== 'object' || !('tools' in result)) {
    throw new Error('MCP tools/list response did not include tools');
  }

  const tools = (result as { tools?: unknown }).tools;
  if (!Array.isArray(tools)) {
    throw new Error('MCP tools/list response tools field was not an array');
  }

  return tools as McpToolDefinition[];
}

interface StartedMcpServer {
  baseUrl: string;
  process: ReturnType<typeof spawn>;
}

async function startMcpServer(
  envOverrides: NodeJS.ProcessEnv = {}
): Promise<StartedMcpServer> {
  const serverProcess = spawn(tsxExecutable, ['mcp-server/server.ts'], {
    cwd: webRootDirectory,
    env: buildMcpServerEnv(envOverrides),
  });

  try {
    const port = await waitForMcpServerStartup(serverProcess);
    return {
      baseUrl: `http://127.0.0.1:${port}`,
      process: serverProcess,
    };
  } catch (error) {
    await stopMcpServer(serverProcess);
    throw error;
  }
}

function buildMcpServerEnv(
  overrides: NodeJS.ProcessEnv = {}
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    MCP_AGENTIC_CHECKOUT_BASE_URL: 'https://ogabassey.test',
    MCP_PORT: '0',
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
    OPENAI_AGENTIC_API_KEY: 'test-agentic-key',
    OPENAI_AGENTIC_SIGNING_KEY: 'test-signing-key',
    PAYSTACK_SECRET_KEY: 'test-paystack-key',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    ...overrides,
  };

  if (!Object.hasOwn(overrides, 'MCP_ENABLE_AGENTIC_CHECKOUT_TOOLS')) {
    delete env.MCP_ENABLE_AGENTIC_CHECKOUT_TOOLS;
  }
  if (!Object.hasOwn(overrides, 'MCP_ENABLE_ORDER_PAYMENT_TOOLS')) {
    delete env.MCP_ENABLE_ORDER_PAYMENT_TOOLS;
  }

  return env;
}

async function waitForMcpServerStartup(
  child: ReturnType<typeof spawn>
): Promise<number> {
  let stderr = '';
  let stdout = '';

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error(
          `Timed out waiting for MCP server startup: stdout=${stdout} stderr=${stderr}`
        )
      );
    }, 10_000);

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
      const startupMatch = /\{[^\n]*"event":"startup"[^\n]*\}/.exec(stdout);
      if (!startupMatch) return;

      const startupEvent = JSON.parse(startupMatch[0]) as { port?: unknown };
      if (typeof startupEvent.port !== 'number' || startupEvent.port <= 0) {
        reject(new Error(`MCP server reported invalid startup port: ${stdout}`));
        return;
      }

      clearTimeout(timeout);
      resolve(startupEvent.port);
    });

    child.once('exit', (code, signal) => {
      clearTimeout(timeout);
      reject(
        new Error(
          `MCP server exited before startup: code=${code ?? 'null'} signal=${
            signal ?? 'null'
          } stdout=${stdout} stderr=${stderr}`
        )
      );
    });

    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

async function stopMcpServer(
  child: ReturnType<typeof spawn> | undefined
): Promise<void> {
  if (!child || child.exitCode !== null) return;

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      resolve();
    }, 5_000);

    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });

    child.kill('SIGTERM');
  });
}
