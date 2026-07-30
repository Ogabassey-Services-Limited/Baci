import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const source = await readFile(new URL('./install.sh', import.meta.url), 'utf8');
const functionSource = (name, next) => {
  const start = source.indexOf(`${name}()`);
  const end = source.indexOf(`${next}()`, start);
  assert.ok(start >= 0 && end > start, `${name} source`);
  return source.slice(start, end);
};

test('routes a changed watchdog render through receipt-bound replacement', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-watchdog-recovery-'));
  context.after(() => rm(root, { force: true, recursive: true }));
  const oldSha = 'a'.repeat(40);
  const nextSha = 'b'.repeat(40);
  const sourceRoot = join(root, 'source');
  const current = join(sourceRoot, nextSha);
  const prior = join(sourceRoot, oldSha);
  const units = join(root, 'units');
  const bootstrap = join(root, 'bootstrap');
  await Promise.all([
    mkdir(current, { recursive: true }),
    mkdir(prior, { recursive: true }),
    mkdir(units, { recursive: true }),
    mkdir(bootstrap, { recursive: true }),
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
  await writeFile(
    join(bootstrap, 'replacement-intent.json'),
    JSON.stringify({ transitionPaths: [target] })
  );
  const expectedPrior = join(root, 'expected-prior.service');
  const initialPrior = template.replace('@BACI_CWV_SOURCE_SHA@', oldSha);
  await writeFile(target, initialPrior, {
    mode: 0o644,
  });
  await writeFile(expectedPrior, initialPrior);
  const node = join(root, 'node');
  await writeFile(
    node,
    `#!/bin/sh
case "$1" in
  *install-bootstrap-replacement-file.mjs)
    [ "$2" = source ] || exit 64
    [ ! -e "$4" ] || /usr/bin/cmp -s "$4" ${JSON.stringify(expectedPrior)} || exit 65
    /bin/cp -- "$5" "$4"
    ;;
esac
exit 0
`
  );
  await chmod(node, 0o755);
  const rawRender = functionSource('render_watchdog', 'install_units');
  const renderWrite = rawRender.indexOf('>"$temporary"');
  const authorizedReplace = rawRender.indexOf(
    'install-bootstrap-replacement-file.mjs" source'
  );
  assert.ok(renderWrite >= 0 && renderWrite < authorizedReplace);
  const render = rawRender
    .replaceAll('/etc/systemd/system', units)
    .replaceAll('/usr/bin/node', node)
    .replaceAll(
      '/usr/bin/stat -c %h',
      process.platform === 'darwin'
        ? '/usr/bin/stat -f %l'
        : '/usr/bin/stat -c %h'
    )
    .replaceAll(
      '/usr/bin/sha256sum',
      process.platform === 'darwin'
        ? '/usr/bin/shasum -a 256'
        : '/usr/bin/sha256sum'
    )
    .replaceAll('/usr/bin/sync -f', '/usr/bin/true')
    .replace('/bin/chown root:root "$temporary"', ':');
  const command = `set -eu
die() { printf '%s\n' "$*" >&2; exit 65; }
regular() { [ -f "$1" ] && [ ! -L "$1" ]; }
root_mode() { return 0; }
sha256() { ${process.platform === 'darwin' ? '/usr/bin/shasum -a 256' : '/usr/bin/sha256sum'} -- "$1" | /usr/bin/awk '{print $1}'; }
is_sha() { printf '%s' "$1" | grep -Eq '^[a-f0-9]{64}$'; }
git_sha() { printf '%s' "$1" | grep -Eq '^[a-f0-9]{40}$'; }
SOURCE_ROOT=${JSON.stringify(sourceRoot)}
SCRIPT_DIR=${JSON.stringify(current)}
BOOTSTRAP_DIRECTORY=${JSON.stringify(bootstrap)}
BACI_CWV_BOOTSTRAP_REPLACEMENT=1
${render}
render_watchdog ${nextSha}`;
  const runRender = () =>
    spawnSync('/bin/sh', ['-c', command], { encoding: 'utf8' });
  const expectedNext = template.replace('@BACI_CWV_SOURCE_SHA@', nextSha);
  const interrupted = join(units, '.baci-cwv-watchdog.A1b2C3');
  await writeFile(interrupted, expectedNext, { mode: 0o644 });
  const result = runRender();

  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(target, 'utf8'), expectedNext);
  assert.deepEqual(
    (await readdir(units)).filter((name) =>
      name.startsWith('.baci-cwv-watchdog.')
    ),
    []
  );
  await rm(target);
  const absent = runRender();
  assert.equal(absent.status, 0, absent.stderr);
  assert.equal(
    await readFile(target, 'utf8'),
    template.replace('@BACI_CWV_SOURCE_SHA@', nextSha)
  );

  const differentPrior = template.replace(
    'Description=Baci CWV campaign watchdog %i',
    'Description=Prior Baci CWV campaign watchdog %i'
  );
  await writeFile(
    join(prior, 'baci-cwv-campaign-watchdog@.service'),
    differentPrior
  );
  await writeFile(
    target,
    differentPrior.replace('@BACI_CWV_SOURCE_SHA@', oldSha)
  );
  await writeFile(
    expectedPrior,
    differentPrior.replace('@BACI_CWV_SOURCE_SHA@', oldSha)
  );
  const sourceDrift = runRender();
  assert.equal(sourceDrift.status, 0, sourceDrift.stderr);
  assert.equal(
    await readFile(target, 'utf8'),
    template.replace('@BACI_CWV_SOURCE_SHA@', nextSha)
  );
  await writeFile(join(prior, 'baci-cwv-campaign-watchdog@.service'), template);
  await writeFile(expectedPrior, initialPrior);

  await writeFile(
    target,
    template
      .replace('@BACI_CWV_SOURCE_SHA@', oldSha)
      .replace('Restart=on-failure', 'Restart=always')
  );
  const drift = runRender();
  assert.equal(drift.status, 65);
  assert.match(drift.stderr, /watchdog unit drift/);

  const foreign = join(units, '.baci-cwv-watchdog.D4e5F6');
  await writeFile(foreign, 'foreign\n', { mode: 0o644 });
  const foreignResult = runRender();
  assert.equal(foreignResult.status, 65);
  assert.match(foreignResult.stderr, /watchdog render temporary drift/);
  assert.equal(await readFile(foreign, 'utf8'), 'foreign\n');

  await rm(foreign);
  const unsafe = join(units, '.baci-cwv-watchdog.G7h8I9');
  await symlink(target, unsafe);
  const unsafeResult = runRender();
  assert.equal(unsafeResult.status, 65);
  assert.match(unsafeResult.stderr, /watchdog render temporary drift/);
  assert.ok((await lstat(unsafe)).isSymbolicLink());
});

test('routes receipt-bound absent file and line installs through the helper', () => {
  for (const [name, next] of [
    ['atomic_line', 'ensure_directory'],
    ['ensure_file', 'assert_sealed_source'],
  ]) {
    const body = functionSource(name, next);
    assert.ok(
      body.indexOf('transitionPaths') <
        body.indexOf('install-bootstrap-replacement-file.mjs') &&
        body.indexOf('install-bootstrap-replacement-file.mjs') <
          body.indexOf('if [ -e "$destination" ]')
    );
  }
  const watchdog = functionSource('render_watchdog', 'install_units');
  assert.ok(
    watchdog.indexOf('install-bootstrap-replacement-file.mjs') <
      watchdog.indexOf('/usr/bin/cmp -s "$temporary" "$target"')
  );
});
