import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

test('uses the sealed policy campaign-mark authority', () => {
  const policySchema =
    // biome-ignore lint/suspicious/noUndeclaredEnvVars: H0 cross-lane fixture input.
    process.env.BACI_CWV_POLICY_SCHEMA_PATH ??
    fileURLToPath(new URL('./policy.schema.mjs', import.meta.url));
  const result = spawnSync(
    process.execPath,
    [policySchema, 'campaign-mark', 'campaign-001'],
    { encoding: 'utf8' }
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(Number(result.stdout.trim()), 0xb6de43ae);
});
