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

test('refuses a provisioned identical bootstrap projection before mutation', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-bootstrap-noop-install-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const node = join(root, 'node');
  const manifest = join(root, 'manifest.json');
  const manifestDigest = join(root, 'manifest.sha256');
  const plan = join(root, 'plan.json');
  const calls = join(root, 'calls');
  const sourceSha = 'a'.repeat(40);
  const file = {
    sha256: 'b'.repeat(64),
    mode: '0600',
    owner: 'root:root',
  };
  const capture = JSON.stringify({
    phase: 'captured',
    prior: { '/srv/baci-cwv/sealed/bootstrap.sha256': file },
    files: { '/srv/baci-cwv/sealed/bootstrap.sha256': file },
  });
  await Promise.all([
    writeFile(manifest, '{}\n'),
    writeFile(manifestDigest, `${'c'.repeat(64)}\n`),
    writeFile(plan, '{}\n'),
    writeFile(calls, ''),
  ]);
  await writeFile(
    node,
    `#!/bin/sh
case "$1" in
  *install-bootstrap-plan.mjs) printf '%s\\n' '{}' ;;
  *install-bootstrap-plan-publication.mjs) cat >/dev/null; printf '%s\\n' ${JSON.stringify(plan)} ;;
  *install-bootstrap-controller.mjs)
    case "$2" in
      begin) mkdir -p -- "$BOOTSTRAP_DIRECTORY"; printf '%s\\n' ${JSON.stringify(capture)} >"$BOOTSTRAP_DIRECTORY/capture.json" ;;
      resume) printf '%s\\n' captured ;;
      replacement-authorize) printf '%s\\n' none ;;
      journal|complete) : ;;
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
install_account() { printf '%s\\n' install_account >>${JSON.stringify(calls)}; }
install_layout() { printf '%s\\n' install_layout >>${JSON.stringify(calls)}; }
install_sealed_helpers() { printf '%s\\n' install_sealed_helpers >>${JSON.stringify(calls)}; }
render_watchdog() { printf '%s\\n' render_watchdog >>${JSON.stringify(calls)}; }
install_units() { printf '%s\\n' install_units >>${JSON.stringify(calls)}; }
atomic_line() { printf '%s\\n' atomic_line >>${JSON.stringify(calls)}; }
UNIT_STATES='{}'
SCRIPT_DIR=${JSON.stringify(root)}
ROOT=${JSON.stringify(root)}
BOOTSTRAP_ROOT=${JSON.stringify(join(root, 'bootstrap'))}
PREPARE_ROOT=${JSON.stringify(join(root, 'prepare'))}
${bootstrap
  .replaceAll('/usr/bin/node', node)
  .replace('/run/lock/baci-cwv-campaign.lock', join(root, 'campaign.lock'))
  .replace('/usr/bin/flock -n 8', '/usr/bin/true')
  .replace('/usr/bin/systemd-analyze verify', '/usr/bin/true')}
bootstrap --source-sha ${sourceSha} --source-manifest ${JSON.stringify(manifest)} --source-manifest-sha256 ${JSON.stringify(manifestDigest)}`;
  const result = spawnSync('/bin/sh', ['-c', command], { encoding: 'utf8' });

  assert.equal(result.status, 65);
  assert.match(
    result.stderr,
    /provisioned identical bootstrap projection requires replacement plan/
  );
  assert.equal(await readFile(calls, 'utf8'), '');
});
