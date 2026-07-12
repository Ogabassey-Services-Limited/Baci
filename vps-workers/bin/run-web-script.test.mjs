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
    /pnpm --filter @baci\/web exec tsx --conditions react-server "\$SCRIPT_FILE" "\$@"/
  );
});

test('passes optional worker arguments through to the TypeScript entrypoint', () => {
  assert.match(runWebScript, /shift 2/);
  assert.match(runWebScript, /\[script-args\.\.\.\]/);
});
