import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const source = await readFile(new URL('./install.sh', import.meta.url), 'utf8');
const bootstrap = source.slice(
  source.indexOf('bootstrap() {'),
  source.indexOf('assert_bootstrap() {')
);

test('a completed retry reconciles a prior published plan before returning', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-bootstrap-complete-retry-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const node = join(root, 'node');
  const priorPlan = join(root, '.plan.A1b2C3');
  const currentPlan = join(root, '.plan.D4e5F6');
  const manifestDigest = join(root, 'manifest.sha256');
  const manifest = join(root, 'manifest.json');
  const calls = join(root, 'calls');
  await Promise.all([
    writeFile(priorPlan, '{}\n', { mode: 0o600 }),
    writeFile(currentPlan, '{}\n', { mode: 0o600 }),
    writeFile(manifestDigest, `${'b'.repeat(64)}\n`),
    writeFile(manifest, '{}\n'),
    writeFile(calls, ''),
  ]);
  await writeFile(
    node,
    `#!/bin/sh
case "$1" in
  *install-bootstrap-plan.mjs) printf '%s\\n' '{}' ;;
  *install-bootstrap-plan-publication.mjs) cat >/dev/null; printf '%s\\n' ${JSON.stringify(currentPlan)} ;;
  *install-bootstrap-controller.mjs)
    printf '%s\\n' "$2" >>${JSON.stringify(calls)}
    case "$2" in
      resume) printf '%s\\n' complete ;;
      replacement-inventory) rm -f -- ${JSON.stringify(priorPlan)} ;;
    esac ;;
esac
`
  );
  await chmod(node, 0o755);
  const command = `set -eu
die() { printf '%s\\n' "$1" >&2; exit 65; }
assert_sealed_source() { :; }
assert_containerd_compatible() { :; }
ensure_directory() { :; }
sha256() { printf '%064d\\n' 0; }
SCRIPT_DIR=${JSON.stringify(root)}
BOOTSTRAP_ROOT=${JSON.stringify(join(root, 'bootstrap'))}
ROOT=${JSON.stringify(root)}
PREPARE_ROOT=${JSON.stringify(join(root, 'prepare'))}
${bootstrap
  .replaceAll('/usr/bin/node', node)
  .replace('/run/lock/baci-cwv-campaign.lock', join(root, 'campaign.lock'))
  .replace('/usr/bin/flock -n 8', '/usr/bin/true')}
bootstrap --source-sha ${'a'.repeat(40)} --source-manifest ${JSON.stringify(manifest)} --source-manifest-sha256 ${JSON.stringify(manifestDigest)}`;

  const result = spawnSync('/bin/sh', ['-c', command], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  await assert.rejects(readFile(priorPlan), { code: 'ENOENT' });
  assert.deepEqual((await readFile(calls, 'utf8')).trim().split('\n'), [
    'begin',
    'resume',
    'verify',
    'replacement-inventory',
  ]);
});
