import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { platform } from 'node:process';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);

const runner = () => (process.getuid?.() === 0 ? [] : ['/usr/bin/sudo', '-n']);

async function rootMountAvailable() {
  if (platform !== 'linux') return false;
  const directory = await mkdtemp(join(tmpdir(), 'baci-cron-mount-probe-'));
  const command = runner();
  try {
    await execFileAsync(command[0] ?? '/bin/sh', [
      ...command.slice(1),
      '/bin/sh',
      '-ceu',
      '[ "$(id -u)" = 0 ]; /usr/bin/mount --bind "$1" "$1"; /usr/bin/mount -o remount,bind,ro "$1" "$1"; /usr/bin/umount "$1"',
      'cron-mount-probe',
      directory,
    ]);
    return true;
  } catch {
    return false;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('publishes cron rollback authority before freezing all later destructive boundaries', async () => {
  const source = await readFile(script, 'utf8');
  const install = source.indexOf(
    'install_crontab; cron_state=$(cron_mutation_state)'
  );
  const receipt = source.indexOf("'. + {cronMutationRollback:$cron}'");
  const quiesce = source.indexOf('record_action quiesce_cron_mutations');
  const disable = source.indexOf('revalidate_before disable_unit', quiesce);
  assert.ok(install > 0 && receipt > install && quiesce > receipt);
  assert.ok(disable > quiesce);
  for (const action of ['disable_unit', 'remove_container', 'delete_models']) {
    assert.match(
      source,
      new RegExp(
        `revalidate_before ${action}; record_action ${action}; assert_scheduled_mutations_quiesced`
      )
    );
  }
});

test('fails closed instead of leaving an absent optional cron surface writable', async () => {
  await assert.rejects(
    execFileAsync(
      '/bin/sh',
      [
        '-c',
        `. "$1"; SCRIPT_DIR=$(dirname "$1"); load_at_quiescence_helper
load_cron_inventory_helper() { :; }
cron_inventory_system_file() { printf /etc/crontab; }
cron_inventory_system_dir() { printf /etc/cron.d; }
cron_inventory_spool_dir() { printf /var/spool/cron/crontabs; }
cron_inventory_anacrontab() { printf /fixture/absent-anacrontab; }
cron_inventory_system_file_ok() { :; }
cron_inventory_system_dir_ok() { :; }
cron_inventory_spool_dir_ok() { :; }
cron_mutation_surface_paths`,
        'cron-optional-absent-test',
        script.pathname,
      ],
      { env: { ...process.env, RETIRE_OLLAMA_TEST_BIN: '/usr/bin' } }
    ),
    (error) =>
      error.code === 65 &&
      /absent anacrontab cannot be quiesced/.test(error.stderr)
  );
});

test('reconciles each identity-bound partial cron mount in reverse order', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-cron-partial-'));
  const log = join(directory, 'unmounted');
  const state = JSON.stringify([
    { path: '/fixture/system', kind: 'file' },
    { path: '/fixture/directory', kind: 'directory' },
    { path: '/fixture/spool', kind: 'directory' },
  ]);
  try {
    await execFileAsync('/bin/sh', [
      '-c',
      `. "$1"
ROOT=$2; EXPECTED=$3
die() { printf '%s\n' "$1" >&2; exit 65; }
assert_cron_mutation_receipt() { :; }
assert_cron_mutation_item() { :; }
cron_mutation_mount_state() { case "$1" in /fixture/system) printf absent;; *) marker="$ROOT/$(basename "$1")"; [ -e "$marker" ] && printf absent || printf ro;; esac; printf '\n'; }
cron_unmount_mutation_surface() { printf '%s\n' "$1" >>"$ROOT/unmounted"; : >"$ROOT/$(basename "$1")"; }
reconcile_interrupted_cron_quiescence "$EXPECTED"`,
      'cron-partial-reconcile-test',
      new URL('./retire-ollama-at-quiescence.sh', import.meta.url).pathname,
      directory,
      state,
    ]);
    assert.equal(
      await readFile(log, 'utf8'),
      '/fixture/spool\n/fixture/directory\n'
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('read-only cron boundaries block concurrent owner-spool and system-cron writers', {
  skip: platform !== 'linux',
}, async (context) => {
  if (!(await rootMountAvailable())) {
    context.skip('exact Linux bind-mount authority is unavailable');
    return;
  }
  const directory = await mkdtemp(join(tmpdir(), 'baci-cron-quiesce-'));
  const system = join(directory, 'crontab');
  const systemDir = join(directory, 'cron.d');
  const spool = join(directory, 'spool');
  const anacron = join(directory, 'anacrontab');
  const periodic = ['hourly', 'daily', 'weekly', 'monthly'].map((name) =>
    join(directory, name)
  );
  await Promise.all([
    mkdir(systemDir),
    mkdir(spool),
    ...periodic.map((path) => mkdir(path)),
    writeFile(system, '0 * * * * root /usr/bin/true\n'),
    writeFile(anacron, '1 5 cron.daily run-parts /etc/cron.daily\n'),
    writeFile(join(spool, 'bassey'), '0 * * * * /usr/bin/true\n'),
  ]);
  const command = runner();
  try {
    const { stdout } = await execFileAsync(command[0] ?? '/bin/sh', [
      ...command.slice(1),
      '/bin/sh',
      '-ceu',
      rootRegression,
      'cron-quiescence-root-test',
      script.pathname,
      directory,
    ]);
    assert.equal(stdout.trim(), 'owner-blocked system-blocked');
  } finally {
    await execFileAsync(command[0] ?? '/bin/sh', [
      ...command.slice(1),
      '/bin/sh',
      '-c',
      rootCleanup,
      'cron-quiescence-cleanup',
      directory,
    ]).catch(() => {
      // Best-effort cleanup follows a failed privileged fixture.
    });
    await rm(directory, { recursive: true, force: true });
  }
});

const rootRegression = `
[ "$(id -u)" = 0 ]
SCRIPT=$1; ROOT=$2; SCRIPT_DIR=$(dirname "$SCRIPT")
. "$SCRIPT"; init_temp_root; trap 'cleanup_temp' EXIT HUP INT TERM
load_at_quiescence_helper
cron_inventory_system_file() { printf '%s\\n' "$ROOT/crontab"; }
cron_inventory_system_dir() { printf '%s\\n' "$ROOT/cron.d"; }
cron_inventory_spool_dir() { printf '%s\\n' "$ROOT/spool"; }
cron_inventory_anacrontab() { printf '%s\\n' "$ROOT/anacrontab"; }
cron_inventory_hourly_dir() { printf '%s\\n' "$ROOT/hourly"; }
cron_inventory_daily_dir() { printf '%s\\n' "$ROOT/daily"; }
cron_inventory_weekly_dir() { printf '%s\\n' "$ROOT/weekly"; }
cron_inventory_monthly_dir() { printf '%s\\n' "$ROOT/monthly"; }
cron_inventory_system_file_ok() { [ -f "$1" ] && [ ! -L "$1" ]; }
cron_inventory_system_dir_ok() { [ -d "$1" ] && [ ! -L "$1" ]; }
cron_inventory_spool_dir_ok() { [ -d "$1" ] && [ ! -L "$1" ]; }
state=$(cron_mutation_state)
quiesce_cron_mutations "$state"
set +e
/bin/sh -c 'printf late >>"$1"' owner-writer "$ROOT/spool/bassey" 2>/dev/null & owner_pid=$!
/bin/sh -c 'printf late >>"$1"' system-writer "$ROOT/crontab" 2>/dev/null & system_pid=$!
wait "$owner_pid"; owner_status=$?; wait "$system_pid"; system_status=$?
set -e
[ "$owner_status" -ne 0 ] && [ "$system_status" -ne 0 ]
assert_cron_mutations_quiesced "$state"
reconcile_interrupted_cron_quiescence "$state"
printf '%s\\n' 'owner-blocked system-blocked'
`;

const rootCleanup = `
ROOT=$1
for path in "$ROOT/monthly" "$ROOT/weekly" "$ROOT/daily" "$ROOT/hourly" "$ROOT/anacrontab" "$ROOT/spool" "$ROOT/cron.d" "$ROOT/crontab"; do
  /usr/bin/findmnt -rn --mountpoint "$path" >/dev/null 2>&1 && /usr/bin/umount "$path"
done
`;

test('keeps quiescence sources within the modularity limit', async () => {
  const [entrypoint, helper] = await Promise.all([
    readFile(script, 'utf8'),
    readFile(
      new URL('./retire-ollama-at-quiescence.sh', import.meta.url),
      'utf8'
    ),
  ]);
  assert.ok(entrypoint.trimEnd().split('\n').length <= 300);
  assert.ok(helper.trimEnd().split('\n').length <= 300);
});
