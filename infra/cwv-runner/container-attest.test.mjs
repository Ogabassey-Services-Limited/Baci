import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = () =>
  readFile(new URL('./container-attest.sh', import.meta.url), 'utf8');

function canonicalJqArguments(shell) {
  const match = /\/usr\/bin\/jq ([^\n]+?) \) \|\|/.exec(shell);
  assert.ok(match, 'runtime attestation canonical jq invocation is present');
  return match[1].trim().split(/\s+/);
}

test('runtime attestation canonical jq invocation rejects an empty collector', async () => {
  const result = spawnSync(
    '/usr/bin/jq',
    canonicalJqArguments(await source()),
    {
      encoding: 'utf8',
      input: '',
    }
  );

  assert.notEqual(result.status, 0, 'empty collector output must be refused');
});
