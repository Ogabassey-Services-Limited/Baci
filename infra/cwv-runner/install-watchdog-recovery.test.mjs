import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const source = await readFile(new URL('./install.sh', import.meta.url), 'utf8');
const functionSource = (name, next) => {
  const start = source.indexOf(`${name}() {`);
  const end = source.indexOf(`\n${next}() {`, start);
  assert.ok(start >= 0 && end > start, `${name} source`);
  return source.slice(start, end);
};

test('replaces only an exact watchdog render from a prior sealed source', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-watchdog-recovery-'));
  context.after(() => rm(root, { force: true, recursive: true }));
  const oldSha = 'a'.repeat(40);
  const nextSha = 'b'.repeat(40);
  const sourceRoot = join(root, 'source');
  const current = join(sourceRoot, nextSha);
  const prior = join(sourceRoot, oldSha);
  const units = join(root, 'units');
  await Promise.all([
    mkdir(current, { recursive: true }),
    mkdir(prior, { recursive: true }),
    mkdir(units, { recursive: true }),
  ]);
  const template = await readFile(
    new URL('./baci-cwv-campaign-watchdog@.service', import.meta.url),
    'utf8'
  );
  for (const directory of [current, prior])
    await writeFile(
      join(directory, 'baci-cwv-campaign-watchdog@.service'),
      template
    );
  const target = join(units, 'baci-cwv-campaign-watchdog@.service');
  await writeFile(target, template.replace('@BACI_CWV_SOURCE_SHA@', oldSha), {
    mode: 0o644,
  });
  const node = join(root, 'node');
  await writeFile(node, '#!/bin/sh\nexit 0\n');
  await chmod(node, 0o755);
  const render = functionSource('render_watchdog', 'install_units')
    .replaceAll('/etc/systemd/system', units)
    .replaceAll('/usr/bin/node', node)
    .replaceAll('/usr/bin/sync -f', '/usr/bin/true')
    .replaceAll('/bin/mv -T --', '/bin/mv -f --')
    .replace('/bin/chown root:root "$temporary"', ':');
  const command = `set -eu
die() { printf '%s\n' "$*" >&2; exit 65; }
regular() { [ -f "$1" ] && [ ! -L "$1" ]; }
root_mode() { return 0; }
sha256() { printf '%064d\n' 0; }
git_sha() { printf '%s' "$1" | grep -Eq '^[a-f0-9]{40}$'; }
SOURCE_ROOT=${JSON.stringify(sourceRoot)}
SCRIPT_DIR=${JSON.stringify(current)}
BOOTSTRAP_DIRECTORY=/fixture
${render}
render_watchdog ${nextSha}`;
  const runRender = () =>
    spawnSync('/bin/sh', ['-c', command], { encoding: 'utf8' });
  const result = runRender();

  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    await readFile(target, 'utf8'),
    template.replace('@BACI_CWV_SOURCE_SHA@', nextSha)
  );

  await writeFile(
    target,
    template
      .replace('@BACI_CWV_SOURCE_SHA@', oldSha)
      .replace('Restart=on-failure', 'Restart=always')
  );
  const drift = runRender();
  assert.equal(drift.status, 65);
  assert.match(drift.stderr, /watchdog unit drift/);
});
