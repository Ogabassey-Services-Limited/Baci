import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const source = await readFile(new URL('./install.sh', import.meta.url), 'utf8');
const sourceSlice = (start, end) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  assert.ok(startIndex >= 0 && endIndex > startIndex);
  return source.slice(startIndex, endIndex);
};

test('disables loaded and enabled watchdog instances without mutating the template', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-watchdog-units-'));
  context.after(() => rm(root, { force: true, recursive: true }));
  const systemd = join(root, 'systemd');
  const runtimeSystemd = join(root, 'runtime-systemd');
  const wants = join(systemd, 'multi-user.target.wants');
  const runtimeWants = join(runtimeSystemd, 'multi-user.target.wants');
  const template = join(systemd, 'baci-cwv-campaign-watchdog@.service');
  const enabled = join(wants, 'baci-cwv-campaign-watchdog@enabled.service');
  const secondEnabled = join(
    wants,
    'baci-cwv-campaign-watchdog@second-enabled.service'
  );
  const runtimeEnabled = join(
    runtimeWants,
    'baci-cwv-campaign-watchdog@runtime-enabled.service'
  );
  await Promise.all([
    mkdir(wants, { recursive: true }),
    mkdir(runtimeWants, { recursive: true }),
  ]);
  await writeFile(template, 'fixture');
  await symlink('../baci-cwv-campaign-watchdog@.service', enabled);
  await symlink('../baci-cwv-campaign-watchdog@.service', secondEnabled);
  await symlink(template, runtimeEnabled);
  const log = join(root, 'systemctl.log');
  const find = join(root, 'find');
  const systemctl = join(root, 'systemctl');
  const node = join(root, 'node');
  await writeFile(
    systemctl,
    `#!/bin/sh
printf '%s\n' "$*" >>"$SYSTEMCTL_LOG"
case "$1" in
  daemon-reload) exit 0 ;;
  list-units) [ "\${FAIL_LIST_UNITS:-0}" != 1 ] || exit 66; [ "\${MALFORMED_GLYPH:-0}" != 1 ] || { printf '%s\n' '▲ baci-cwv-campaign-watchdog@live.service loaded failed failed fixture'; exit 0; }; printf '%s\n' '● baci-cwv-campaign-watchdog@live.service loaded failed failed fixture'; exit 0 ;;
  list-unit-files) [ "\${FAIL_LIST_UNIT_FILES:-0}" != 1 ] || exit 67; printf '%s\n' 'baci-cwv-campaign-watchdog@.service indirect enabled'; exit 0 ;;
  disable) for last; do :; done; [ "$last" != 'baci-cwv-campaign-watchdog@.service' ] || exit 64; exit 0 ;;
  reset-failed) exit 0 ;;
  show) case "$2" in *'@live.service') /usr/bin/grep -Fq "reset-failed $2" "$SYSTEMCTL_LOG" || { printf 'loaded\nfailed\ndisabled\n'; exit 0; };; esac; case "$2" in *'@'*) unit_state=disabled;; *) unit_state=static;; esac; printf 'loaded\ninactive\n%s\n' "$unit_state"; exit 0 ;;
  is-enabled) printf 'disabled\n'; exit 1 ;;
esac
exit 65
`
  );
  await writeFile(
    find,
    `#!/bin/sh
[ "\${FAIL_FIND:-0}" != 1 ] || exit 68
case "$1" in
  "$PERSISTENT_SYSTEMD") printf '%s\\n' "$ENABLED_LINK" "$SECOND_ENABLED_LINK" ;;
  "$RUNTIME_SYSTEMD") printf '%s\\n' "$RUNTIME_ENABLED_LINK" ;;
  *) exit 69 ;;
esac
`
  );
  await writeFile(node, '#!/bin/sh\nexit 0\n');
  await Promise.all([find, systemctl, node].map((path) => chmod(path, 0o755)));
  const installUnits = sourceSlice(
    'install_units() {',
    'install_sealed_helpers() {'
  )
    .replaceAll('/etc/systemd/system', systemd)
    .replaceAll('/run/systemd/system', runtimeSystemd)
    .replaceAll('/usr/bin/find', find)
    .replaceAll('/bin/systemctl', systemctl)
    .replaceAll('/usr/bin/node', node);
  const command = `set -eu
die() { printf '%s\n' "$*" >&2; exit 65; }
ensure_file() { :; }
sha256() { printf '%064d\n' 0; }
ROOT=/fixture SCRIPT_DIR=/fixture BOOTSTRAP_DIRECTORY=/fixture
${installUnits}
install_units
printf '%s' "$UNIT_STATES"`;
  const run = (extra = {}) =>
    spawnSync('/bin/sh', ['-c', command], {
      encoding: 'utf8',
      env: {
        ...process.env,
        ENABLED_LINK: enabled,
        PERSISTENT_SYSTEMD: systemd,
        RUNTIME_ENABLED_LINK: runtimeEnabled,
        RUNTIME_SYSTEMD: runtimeSystemd,
        SECOND_ENABLED_LINK: secondEnabled,
        SYSTEMCTL_LOG: log,
        ...extra,
      },
    });
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  const unitStates = JSON.parse(result.stdout);
  assert.deepEqual(
    Object.keys(unitStates).sort(),
    [
      'baci-cwv-containerd.service',
      'baci-cwv-docker.service',
      'baci-cwv-host-sampler.service',
      'baci-cwv-host-sampler.timer',
      'baci-cwv-measurement.service',
      'baci-cwv-campaign-watchdog@.service',
    ].sort()
  );
  for (const state of Object.values(unitStates)) {
    assert.match(state, /^loaded\ninactive\n(?:disabled|static)\n$/);
    assert.doesNotMatch(state, /\\n$/);
  }
  const calls = await readFile(log, 'utf8');
  assert.doesNotMatch(calls, /disable --now .*watchdog@\.service/);
  assert.match(calls, /disable --now .*watchdog@live\.service/);
  assert.match(calls, /reset-failed .*watchdog@live\.service/);
  assert.match(calls, /disable --now .*watchdog@enabled\.service/);
  assert.match(calls, /disable --now .*watchdog@second-enabled\.service/);
  assert.match(calls, /disable --runtime .*watchdog@runtime-enabled\.service/);
  assert.match(calls, /is-enabled .*watchdog@\.service/);
  assert.match(calls, /list-units .* --full /);
  assert.match(calls, /list-unit-files .* --full /);
  for (const failure of [
    'FAIL_LIST_UNITS',
    'FAIL_LIST_UNIT_FILES',
    'FAIL_FIND',
    'MALFORMED_GLYPH',
  ]) {
    const refused = run({ [failure]: '1' });
    assert.equal(refused.status, 65, `${failure}: ${refused.stderr}`);
    assert.match(refused.stderr, /watchdog instance inventory refused/);
  }
  await rm(enabled);
  await writeFile(join(systemd, 'wrong.service'), 'wrong');
  await symlink('../wrong.service', enabled);
  const wrongTarget = run();
  assert.equal(wrongTarget.status, 65);
  assert.match(wrongTarget.stderr, /watchdog instance inventory refused/);
});

test('bootstrap holds the campaign lock until its transaction completes', () => {
  const bootstrap = sourceSlice('bootstrap() {', 'assert_bootstrap() {');
  const lock = bootstrap.indexOf('flock -n 8');
  assert.ok(lock >= 0 && lock < bootstrap.indexOf('install_units'));
  assert.ok(bootstrap.indexOf(' complete ', lock) > lock);
});

test('a losing concurrent bootstrap cannot publish a legacy plan', () => {
  const bootstrap = sourceSlice('bootstrap() {', 'assert_bootstrap() {');
  const lock = bootstrap.indexOf('flock -n 8');
  const plan = bootstrap.indexOf('install-bootstrap-plan-publication.mjs');
  assert.ok(lock >= 0 && plan > lock);
  assert.doesNotMatch(bootstrap, /mktemp[^\n]+\.plan\./);
});

test('requests full watchdog names from both systemd inventories', () => {
  const installUnits = sourceSlice(
    'install_units() {',
    'install_sealed_helpers() {'
  );
  assert.match(installUnits, /list-units[^\n]+ --full /);
  assert.match(installUnits, /list-unit-files[^\n]+ --full /);
});
