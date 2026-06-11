import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer as createNodeServer } from 'node:http';
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
    const port = await getAvailablePort();
    serverBaseUrl = `http://127.0.0.1:${port}`;

    serverProcess = spawn('pnpm', ['exec', 'tsx', 'mcp-server/server.ts'], {
      cwd: webRootDirectory,
      env: {
        ...process.env,
        MCP_PORT: String(port),
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      },
    });

    await waitForMcpServerStartup(serverProcess);
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
});

async function getAvailablePort() {
  return new Promise<number>((resolve, reject) => {
    const probe = createNodeServer();

    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (!address || typeof address === 'string') {
        probe.close();
        reject(new Error('Unable to allocate MCP test port'));
        return;
      }

      probe.close(() => resolve(address.port));
    });
  });
}

async function waitForMcpServerStartup(
  child: ReturnType<typeof spawn>
): Promise<void> {
  let stderr = '';

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for MCP server startup: ${stderr}`));
    }, 10_000);

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.stdout.on('data', (chunk: Buffer) => {
      const output = chunk.toString('utf8');
      if (output.includes('"event":"startup"')) {
        clearTimeout(timeout);
        resolve();
      }
    });

    child.once('exit', (code, signal) => {
      clearTimeout(timeout);
      reject(
        new Error(
          `MCP server exited before startup: code=${code ?? 'null'} signal=${
            signal ?? 'null'
          } stderr=${stderr}`
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
