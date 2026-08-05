import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
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
import { platform } from 'node:process';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const helper = new URL('./retire-ollama-at-quiescence.sh', import.meta.url);

async function rootBindMountAvailable(
  effectiveUid = process.getuid?.(),
  execute = execFileAsync
) {
  const directory = await mkdtemp(join(tmpdir(), 'baci-atq-mount-probe-'));
  const source = join(directory, 'source');
  const target = join(directory, 'target');
  await Promise.all([mkdir(source), mkdir(target)]);
  const runner = effectiveUid === 0 ? [] : ['/usr/bin/sudo', '-n'];
  try {
    await execute(
      runner[0] ?? '/bin/sh',
      runner.length
        ? [
            ...runner.slice(1),
            '/bin/sh',
            '-c',
            rootMountCapabilityProbe,
            'retire-ollama-root-mount-probe',
            source,
            target,
          ]
        : [
            '-c',
            rootMountCapabilityProbe,
            'retire-ollama-root-mount-probe',
            source,
            target,
          ]
    );
    return true;
  } catch {
    return false;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const rootMountCapabilityProbe = `set -eu
[ "$(id -u)" = 0 ]
source=$1; target=$2; mounted=no
cleanup() {
  status=$?
  trap - EXIT HUP INT TERM
  if [ "$mounted" = yes ]; then
    /usr/bin/umount "$target" || status=1
    mounted=no
  fi
  exit "$status"
}
trap cleanup EXIT HUP INT TERM
/usr/bin/mount --bind "$source" "$target"
mounted=yes
/usr/bin/mount -o remount,bind,ro "$target" "$target"
value=$(/usr/bin/findmnt -rn --vfs-all --mountpoint "$target" -o TARGET,VFS-OPTIONS)
[ "\${value%% *}" = "$target" ]
case ",\${value#* }," in *,ro,*) :;; *) exit 1;; esac
/usr/bin/umount "$target"
mounted=no
if /usr/bin/findmnt -rn --mountpoint "$target" >/dev/null; then
  exit 1
else
  [ "$?" -eq 1 ]
fi
`;

test('does not assume uid zero has bind-mount authority', async () => {
  const mountDenied = () =>
    Promise.reject(new Error('mount permission denied'));
  assert.equal(await rootBindMountAvailable(0, mountDenied), false);
});

test('audits default VFS options to classify exact read-write and read-only mounts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-atq-findmnt-'));
  const findmnt = join(directory, 'findmnt');
  const helperCopy = join(directory, 'retire-ollama-at-quiescence.sh');
  try {
    await writeFile(
      findmnt,
      `#!/bin/sh
seen_vfs_all=no
target=''
while [ "$#" -gt 0 ]; do
  case "$1" in
    --vfs-all) seen_vfs_all=yes;;
    --mountpoint) shift; target=$1;;
  esac
  shift
done
[ -n "$target" ] || exit 64
if [ "$seen_vfs_all" != yes ]; then
  printf '%s relatime\n' "$target"
  exit 0
fi
case "$AUDITED_MOUNT_MODE" in
  ro|rw) printf '%s %s,relatime\n' "$target" "$AUDITED_MOUNT_MODE";;
  *) exit 64;;
esac
`
    );
    await chmod(findmnt, 0o755);
    await writeFile(
      helperCopy,
      (await readFile(helper, 'utf8')).replaceAll('/usr/bin/findmnt', findmnt)
    );

    const { stdout } = await execFileAsync('/bin/sh', [
      '-c',
      `. "$1"
die() { printf '%s\n' "$1" >&2; exit 65; }
AT_JOB_DIR=$2
AUDITED_MOUNT_MODE=rw; export AUDITED_MOUNT_MODE
at_submission_mount_state
AUDITED_MOUNT_MODE=ro; export AUDITED_MOUNT_MODE
at_submission_mount_state`,
      'retire-ollama-atq-findmnt-test',
      helperCopy,
      join(directory, 'atjobs'),
    ]);
    assert.equal(stdout, 'rw\nro\n');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('kernel read-only bind blocks a root submission after the final queue check', {
  skip: platform !== 'linux',
}, async (context) => {
  if (!(await rootBindMountAvailable())) {
    context.skip('exact bind-mount authority is unavailable');
    return;
  }
  const directory = await mkdtemp(join(tmpdir(), 'baci-atq-root-bind-'));
  const runner = process.getuid?.() === 0 ? [] : ['/usr/bin/sudo', '-n'];
  try {
    const { stdout } = await execFileAsync(
      runner[0] ?? '/bin/sh',
      runner.length
        ? [
            ...runner.slice(1),
            '/bin/sh',
            '-c',
            rootRegressionScript,
            'retire-ollama-root-bind-test',
            helper.pathname,
            directory,
          ]
        : [
            '-c',
            rootRegressionScript,
            'retire-ollama-root-bind-test',
            helper.pathname,
            directory,
          ]
    );
    assert.match(stdout, /^root-write-blocked$/m);
  } finally {
    await execFileAsync(
      runner[0] ?? '/bin/sh',
      runner.length
        ? [
            ...runner.slice(1),
            '/bin/sh',
            '-c',
            rootCleanupScript,
            'retire-ollama-root-bind-cleanup',
            directory,
          ]
        : [
            '-c',
            rootCleanupScript,
            'retire-ollama-root-bind-cleanup',
            directory,
          ]
    );
    await rm(directory, { recursive: true, force: true });
  }
});

const rootCleanupScript = `set -eu
[ "$(id -u)" = 0 ]
AT_JOB_DIR=$1/atjobs
if [ -d "$AT_JOB_DIR" ]; then
  if /usr/bin/findmnt -rn --mountpoint "$AT_JOB_DIR" >/dev/null; then
    /usr/bin/umount "$AT_JOB_DIR"
  else
    [ "$?" -eq 1 ]
  fi
  /bin/chmod 0700 "$AT_JOB_DIR"
  /bin/rm -rf -- "$AT_JOB_DIR"
fi
`;

const rootRegressionScript = `set -eu
[ "$(id -u)" = 0 ]
HELPER=$1; ROOT=$2; AT_JOB_DIR=$ROOT/atjobs
mkdir "$AT_JOB_DIR"; chmod 1770 "$AT_JOB_DIR"
printf '0\n' >"$AT_JOB_DIR/.SEQ"; chmod 0600 "$AT_JOB_DIR/.SEQ"
mounted=no
cleanup() {
  trap - EXIT HUP INT TERM
  if [ "$mounted" != no ] && /usr/bin/findmnt -rn --mountpoint "$AT_JOB_DIR" >/dev/null; then
    /usr/bin/umount "$AT_JOB_DIR"
    mounted=no
  fi
}
trap cleanup EXIT HUP INT TERM
die() { printf '%s\n' "$1" >&2; exit 65; }
cron_inventory_require_empty_at_queue() { :; }
. "$HELPER"
expected=$(at_submission_state)
at_create_bind_mount
mounted=yes
[ "$(at_submission_mount_state)" = rw ]
at_remount_bind_readonly
assert_at_submissions_quiesced "$expected"
if touch "$AT_JOB_DIR/root-late-job" 2>/dev/null; then
  die 'root write bypassed read-only bind'
fi
printf '%s\n' root-write-blocked
`;
