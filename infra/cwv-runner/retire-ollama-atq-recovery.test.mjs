import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);
const helper = new URL('./retire-ollama-at-quiescence.sh', import.meta.url);

async function writeStatShim(bin) {
  await writeFile(
    join(bin, 'stat'),
    `#!/bin/sh
if [ "$(uname -s)" = Linux ]; then
  if [ "$1:$2" = '-c:%u:%a' ]; then printf '0:'; exec /usr/bin/stat -c %a "$3"; fi
  exec /usr/bin/stat "$@"
fi
[ "$1" = -c ] || exit 64
format=$2; path=$3
case "$format" in
  '%d:%i:%u:%g:%a')
    prefix=''; [ -k "$path" ] && prefix=1
    printf '%s:%s:%s:%s:%s%s\n' "$(/usr/bin/stat -f %d "$path")" "$(/usr/bin/stat -f %i "$path")" "$(/usr/bin/stat -f %u "$path")" "$(/usr/bin/stat -f %g "$path")" "$prefix" "$(/usr/bin/stat -f %Lp "$path")";;
  '%u:%a') printf '0:'; exec /usr/bin/stat -f '%Lp' "$path";;
  *) exit 64;;
esac
`
  );
  await chmod(join(bin, 'stat'), 0o755);
}

test('reconciles only an identity-bound interrupted read-only bind', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-atq-reconcile-'))
  );
  const bin = join(directory, 'bin');
  const receiptDirectory = join(directory, 'receipts');
  const atJobs = join(directory, 'atjobs');
  const mountState = join(directory, 'mount-state');
  await Promise.all([
    mkdir(bin),
    mkdir(receiptDirectory),
    mkdir(atJobs),
    writeFile(mountState, 'absent\n'),
  ]);
  await chmod(atJobs, 0o1770);
  await writeFile(join(atJobs, '.SEQ'), '0\n', { mode: 0o600 });
  await writeStatShim(bin);
  const identity = await stat(atJobs);
  const sequenceIdentity = await stat(join(atJobs, '.SEQ'));
  await writeFile(
    join(receiptDirectory, 'pre-destructive.json'),
    `${JSON.stringify({
      phase: 'pre-destructive',
      atSubmissionRollback: {
        path: atJobs,
        identity: `${identity.dev}:${identity.ino}:${identity.uid}:${identity.gid}`,
        sequenceIdentity: `${sequenceIdentity.dev}:${sequenceIdentity.ino}:${sequenceIdentity.uid}:${sequenceIdentity.gid}`,
        originalMountState: 'absent',
        quiescedMountState: 'ro-bind',
      },
    })}\n`,
    { mode: 0o600 }
  );
  await writeFile(
    join(receiptDirectory, 'pre-destructive.actions'),
    'quiesce_at_submissions\n',
    { mode: 0o600 }
  );
  const originalSequence = join(atJobs, '.SEQ.original');
  const env = {
    ...process.env,
    RETIRE_OLLAMA_TEST_BIN: bin,
    RETIRE_OLLAMA_AT_QUIESCENCE_HELPER: helper.pathname,
  };
  await rename(join(atJobs, '.SEQ'), originalSequence);
  await writeFile(join(atJobs, '.SEQ'), '0\n', { mode: 0o600 });
  await assert.rejects(
    execFileAsync(
      'sh',
      [
        '-c',
        `. "$1"; RECEIPT_DIR=$2; AT_JOB_DIR=$3; MOUNT_STATE=$4; fsync_dir() { :; }; cron_inventory_require_empty_at_queue() { :; }; load_at_quiescence_helper; at_submission_mount_state() { cat "$MOUNT_STATE"; }; at_create_bind_mount() { printf 'rw\n' >"$MOUNT_STATE"; }; at_remount_bind_readonly() { printf 'ro\n' >"$MOUNT_STATE"; }; expected=$(jq -c .atSubmissionRollback "$RECEIPT_DIR/pre-destructive.json"); quiesce_at_submissions "$expected"`,
        'retire-ollama-atq-quiesce-swapped-sequence-test',
        script.pathname,
        receiptDirectory,
        atJobs,
        mountState,
      ],
      { env }
    ),
    /at submission spool changed/
  );
  await rm(join(atJobs, '.SEQ'));
  await rename(originalSequence, join(atJobs, '.SEQ'));
  await writeFile(mountState, 'ro\n');
  try {
    await rename(join(atJobs, '.SEQ'), originalSequence);
    await writeFile(join(atJobs, '.SEQ'), '0\n', { mode: 0o600 });
    await assert.rejects(
      execFileAsync(
        'sh',
        [
          '-c',
          `. "$1"; RECEIPT_DIR=$2; AT_JOB_DIR=$3; MOUNT_STATE=$4; fsync_dir() { :; }; load_at_quiescence_helper; at_submission_mount_state() { cat "$MOUNT_STATE"; }; at_unmount_submission_spool() { printf 'absent\n' >"$MOUNT_STATE"; }; reconcile_interrupted_at_quiescence`,
          'retire-ollama-atq-reconcile-swapped-sequence-test',
          script.pathname,
          receiptDirectory,
          atJobs,
          mountState,
        ],
        { env }
      ),
      /at submission identity drift/
    );
    assert.equal(await readFile(mountState, 'utf8'), 'ro\n');
    await rm(join(atJobs, '.SEQ'));
    await rename(originalSequence, join(atJobs, '.SEQ'));
    await execFileAsync(
      'sh',
      [
        '-c',
        `. "$1"; RECEIPT_DIR=$2; AT_JOB_DIR=$3; MOUNT_STATE=$4; fsync_dir() { :; }; load_at_quiescence_helper; at_submission_mount_state() { cat "$MOUNT_STATE"; }; at_unmount_submission_spool() { printf 'absent\n' >"$MOUNT_STATE"; }; reconcile_interrupted_at_quiescence`,
        'retire-ollama-atq-reconcile-test',
        script.pathname,
        receiptDirectory,
        atJobs,
        mountState,
      ],
      { env }
    );
    assert.equal(await readFile(mountState, 'utf8'), 'absent\n');
    await assert.rejects(
      readFile(join(receiptDirectory, 'pre-destructive.json'))
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
