import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const runWebScript = readFileSync(join(scriptDir, 'run-web-script.sh'), 'utf8');

test('runs web scripts with the React Server condition', () => {
  assert.match(
    runWebScript,
    /"\$TSX_BIN" --conditions react-server "\$SCRIPT_FILE" "\$@"/
  );
});

test('uses the installed tsx binary without triggering pnpm dependency mutation', () => {
  assert.match(runWebScript, /TSX_BIN="\$REPO_DIR\/node_modules\/\.bin\/tsx"/);
  assert.doesNotMatch(runWebScript, /pnpm .*exec tsx/);
});

test('passes optional worker arguments through to the TypeScript entrypoint', () => {
  assert.match(runWebScript, /shift 2/);
  assert.match(runWebScript, /\[script-args\.\.\.\]/);
});
