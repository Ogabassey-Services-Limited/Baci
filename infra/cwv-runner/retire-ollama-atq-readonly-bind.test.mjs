import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
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
    await rm(directory, { recursive: true, force: true });
  }
});

const rootRegressionScript = `set -eu
[ "$(id -u)" = 0 ]
HELPER=$1; ROOT=$2; AT_JOB_DIR=$ROOT/atjobs
mkdir "$AT_JOB_DIR"; chmod 1770 "$AT_JOB_DIR"
printf '0\n' >"$AT_JOB_DIR/.SEQ"; chmod 0600 "$AT_JOB_DIR/.SEQ"
mounted=no
cleanup() {
  [ "$mounted" = no ] || /usr/bin/umount "$AT_JOB_DIR"
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
