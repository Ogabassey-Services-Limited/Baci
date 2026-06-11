import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

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
  it('allows the MCP protocol version header in CORS preflights', () => {
    expect(serverSource).toContain(
      "const MCP_ALLOWED_HEADERS = 'content-type, mcp-protocol-version, mcp-session-id';"
    );
    expect(serverSource).toContain(
      "'Access-Control-Allow-Headers': MCP_ALLOWED_HEADERS"
    );
  });

  it('responds to HEAD liveness checks on the MCP endpoint', () => {
    expect(serverSource).toContain(
      "if (req.method === 'HEAD' && url.pathname === MCP_PATH)"
    );
    expect(serverSource).toContain("method: 'HEAD'");
    expect(serverSource).toContain('statusCode: 200');
  });
});
