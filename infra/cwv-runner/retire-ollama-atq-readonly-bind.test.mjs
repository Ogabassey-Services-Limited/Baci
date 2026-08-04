import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { platform } from 'node:process';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const helper = new URL('./retire-ollama-at-quiescence.sh', import.meta.url);

async function rootShellAvailable() {
  if (process.getuid?.() === 0) return true;
  try {
    await execFileAsync('/usr/bin/sudo', ['-n', '/bin/true']);
    return true;
  } catch {
    return false;
  }
}

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
}, async () => {
  assert.equal(
    await rootShellAvailable(),
    true,
    'Linux CI must provide root or passwordless sudo for the production barrier regression'
  );
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
