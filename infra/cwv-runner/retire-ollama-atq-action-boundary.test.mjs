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

async function writeStatShim(bin) {
  await writeFile(
    join(bin, 'stat'),
    `#!/bin/sh
[ "$1" = -c ] || exit 64
format=$2; path=$3
case "$format" in
  '%d:%i:%u:%g:%a')
    prefix=''; [ -k "$path" ] && prefix=1
    printf '%s:%s:%s:%s:%s%s\n' "$(/usr/bin/stat -f %d "$path")" "$(/usr/bin/stat -f %i "$path")" "$(/usr/bin/stat -f %u "$path")" "$(/usr/bin/stat -f %g "$path")" "$prefix" "$(/usr/bin/stat -f %Lp "$path")";;
  '%u:%g:%a') exec /usr/bin/stat -f '%u:%g:%Lp' "$path";;
  '%u:%a') printf '0:'; exec /usr/bin/stat -f '%Lp' "$path";;
  *) exit 64;;
esac
`
  );
  await chmod(join(bin, 'stat'), 0o755);
}

async function runApplyWithLateAtJob(target) {
  const directory = await mkdtemp(join(tmpdir(), 'baci-atq-action-'));
  const receiptDirectory = join(directory, 'receipts');
  const receipt = join(directory, 'receipt.json');
  const inventory = join(directory, 'inventory.json');
  const queue = join(directory, 'atq');
  const actions = join(directory, 'actions');
  await execFileAsync('mkdir', ['-p', receiptDirectory]);
  await writeFile(receipt, '{"scan":{"dependencies":[]}}\n');
  await writeFile(inventory, '{"reviewStatus":"approved"}\n');
  try {
    await execFileAsync(
      'sh',
      [
        '-c',
        `. "$1"
RECEIPT_DIR=$2; RECEIPT=$3; INVENTORY=$4; QUEUE=$5; ACTIONS=$6; TARGET=$7
root() { :; }; init_temp_root() { :; }; cleanup_temp() { :; }
canonical_receipt() { :; }; assert_approved_dependency_classes() { :; }; assert_zero_consumers() { :; }
approved_dependency_sha() { printf 'approved\\n'; }; dependency_sha() { printf 'approved\\n'; }
ensure_receipt_dir() { :; }; pending_for() { printf '%s.pending\\n' "$1"; }; publish_pending() { mv "$1" "$2"; }
completion_metrics() { printf '{"cgroupMemoryBytes":0,"hostAvailableMemoryBytes":0,"modelStoreBytes":0}\\n'; }
canonical_receipt_digest() { printf '%064d\\n' 0; }
record_action() { :; }
revalidate_before() { if [ "$1" = "$TARGET" ]; then printf 'queued\\n' >"$QUEUE"; else : >"$QUEUE"; fi; }
cron_inventory_require_empty_at_queue() { [ ! -s "$QUEUE" ]; }
at_submission_state() { printf '{}\\n'; }; quiesce_at_submissions() { :; }
assert_at_submissions_quiesced() { cron_inventory_require_empty_at_queue || die 'queued work or an unsafe queue'; }
install_crontab() { printf '%s\\n' install_crontab >>"$ACTIONS"; }
disable_unit() { printf '%s\\n' disable_unit >>"$ACTIONS"; }
remove_container() { printf '%s\\n' remove_container >>"$ACTIONS"; }
delete_models() { printf '%s\\n' delete_models >>"$ACTIONS"; }
apply`,
        'retire-ollama-atq-action-boundary-test',
        script.pathname,
        receiptDirectory,
        receipt,
        inventory,
        queue,
        actions,
        target,
      ],
      { env: { ...process.env, RETIRE_OLLAMA_TEST_BIN: '/usr/bin' } }
    );
    return { error: null, actions: await readFile(actions, 'utf8') };
  } catch (error) {
    let performed = '';
    try {
      performed = await readFile(actions, 'utf8');
    } catch {
      // No destructive action ran before the refusal.
    }
    return { error, actions: performed };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

for (const action of [
  'install_crontab',
  'disable_unit',
  'remove_container',
  'delete_models',
]) {
  test(`refuses ${action} when an at job appears after its full revalidation`, async () => {
    const result = await runApplyWithLateAtJob(action);
    assert.equal(result.error?.code, 65);
    assert.match(result.error?.stderr ?? '', /queued work or an unsafe queue/);
    assert.ok(!result.actions.split('\n').includes(action));
  });
}

test('blocks an at submission after the terminal queue check and before model deletion', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-atq-quiescence-'))
  );
  const bin = join(directory, 'bin');
  const receiptDirectory = join(directory, 'receipts');
  const atJobs = join(directory, 'atjobs');
  const receipt = join(directory, 'receipt.json');
  const inventory = join(directory, 'inventory.json');
  const actions = join(directory, 'actions');
  await Promise.all([
    mkdir(bin),
    mkdir(receiptDirectory),
    mkdir(atJobs, { mode: 0o1770 }),
    writeFile(receipt, '{"scan":{"dependencies":[]}}\n'),
    writeFile(inventory, '{"reviewStatus":"approved"}\n'),
  ]);
  await chmod(atJobs, 0o1770);
  await writeFile(join(atJobs, '.SEQ'), '0\n', { mode: 0o600 });
  await writeStatShim(bin);
  try {
    await execFileAsync(
      'sh',
      [
        '-c',
        `. "$1"
RECEIPT_DIR=$2; RECEIPT=$3; INVENTORY=$4; AT_JOB_DIR=$5; ACTIONS=$6
root() { :; }; init_temp_root() { :; }; cleanup_temp() { :; }; fsync_dir() { :; }
canonical_receipt() { :; }; assert_approved_dependency_classes() { :; }; assert_zero_consumers() { :; }
approved_dependency_sha() { printf 'approved\\n'; }; dependency_sha() { printf 'approved\\n'; }
ensure_receipt_dir() { :; }; pending_for() { printf '%s.pending\\n' "$1"; }; publish_pending() { mv "$1" "$2"; }
completion_metrics() { printf '{"cgroupMemoryBytes":0,"hostAvailableMemoryBytes":0,"modelStoreBytes":0}\\n'; }
canonical_receipt_digest() { printf '%064d\\n' 0; }
revalidate_before() { :; }; cron_inventory_require_empty_at_queue() { :; }
install_crontab() { printf '%s\\n' install_crontab >>"$ACTIONS"; }
disable_unit() { printf '%s\\n' disable_unit >>"$ACTIONS"; }
remove_container() { printf '%s\\n' remove_container >>"$ACTIONS"; }
delete_models() { touch "$AT_JOB_DIR/late-job" 2>/dev/null && printf '%s\\n' submitted >>"$ACTIONS"; printf '%s\\n' delete_models >>"$ACTIONS"; }
apply`,
        'retire-ollama-atq-quiescence-test',
        script.pathname,
        receiptDirectory,
        receipt,
        inventory,
        atJobs,
        actions,
      ],
      { env: { ...process.env, RETIRE_OLLAMA_TEST_BIN: bin } }
    );
    const performed = await readFile(actions, 'utf8');
    assert.doesNotMatch(performed, /^submitted$/m);
    assert.match(performed, /^delete_models$/m);
    assert.match(
      await readFile(join(receiptDirectory, 'pre-destructive.actions'), 'utf8'),
      /^quiesce_at_submissions$/m
    );
    assert.equal((await stat(atJobs)).mode & 0o7777, 0o1550);
    const rollback = JSON.parse(
      await readFile(join(receiptDirectory, 'pre-destructive.json'), 'utf8')
    ).atSubmissionRollback;
    assert.equal(rollback.path, atJobs);
    assert.equal(rollback.originalMode, '1770');
    assert.equal(rollback.quiescedMode, '1550');
    assert.match(rollback.identity, /^\d+:\d+:\d+:\d+$/);
    assert.match(rollback.sequenceIdentity, /^\d+:\d+:\d+:\d+$/);
  } finally {
    await chmod(atJobs, 0o1770);
    await rm(directory, { recursive: true, force: true });
  }
});

test('restores and reconciles a crash after submission quiescence but before the first destructive action', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-atq-reconcile-'))
  );
  const bin = join(directory, 'bin');
  const receiptDirectory = join(directory, 'receipts');
  const atJobs = join(directory, 'atjobs');
  await Promise.all([mkdir(bin), mkdir(receiptDirectory), mkdir(atJobs)]);
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
        originalMode: '1770',
        quiescedMode: '1550',
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
  await rename(join(atJobs, '.SEQ'), originalSequence);
  await writeFile(join(atJobs, '.SEQ'), '0\n', { mode: 0o600 });
  await assert.rejects(
    execFileAsync(
      'sh',
      [
        '-c',
        `. "$1"; RECEIPT_DIR=$2; AT_JOB_DIR=$3; fsync_dir() { :; }; cron_inventory_require_empty_at_queue() { :; }; expected=$(jq -c .atSubmissionRollback "$RECEIPT_DIR/pre-destructive.json"); quiesce_at_submissions "$expected"`,
        'retire-ollama-atq-quiesce-swapped-sequence-test',
        script.pathname,
        receiptDirectory,
        atJobs,
      ],
      { env: { ...process.env, RETIRE_OLLAMA_TEST_BIN: bin } }
    ),
    /at submission spool changed/
  );
  assert.equal((await stat(atJobs)).mode & 0o7777, 0o1770);
  await rm(join(atJobs, '.SEQ'));
  await rename(originalSequence, join(atJobs, '.SEQ'));
  await chmod(atJobs, 0o1550);
  try {
    await chmod(atJobs, 0o1770);
    await rename(join(atJobs, '.SEQ'), originalSequence);
    await writeFile(join(atJobs, '.SEQ'), '0\n', { mode: 0o600 });
    await chmod(atJobs, 0o1550);
    await assert.rejects(
      execFileAsync(
        'sh',
        [
          '-c',
          `. "$1"; RECEIPT_DIR=$2; AT_JOB_DIR=$3; fsync_dir() { :; }; reconcile_interrupted_at_quiescence`,
          'retire-ollama-atq-reconcile-swapped-sequence-test',
          script.pathname,
          receiptDirectory,
          atJobs,
        ],
        { env: { ...process.env, RETIRE_OLLAMA_TEST_BIN: bin } }
      ),
      /at rollback sequence drift/
    );
    assert.equal((await stat(atJobs)).mode & 0o7777, 0o1550);
    await chmod(atJobs, 0o1770);
    await rm(join(atJobs, '.SEQ'));
    await rename(originalSequence, join(atJobs, '.SEQ'));
    await chmod(atJobs, 0o1550);
    await execFileAsync(
      'sh',
      [
        '-c',
        `. "$1"; RECEIPT_DIR=$2; AT_JOB_DIR=$3; fsync_dir() { :; }; reconcile_interrupted_at_quiescence`,
        'retire-ollama-atq-reconcile-test',
        script.pathname,
        receiptDirectory,
        atJobs,
      ],
      { env: { ...process.env, RETIRE_OLLAMA_TEST_BIN: bin } }
    );
    assert.equal((await stat(atJobs)).mode & 0o7777, 0o1770);
    await assert.rejects(
      readFile(join(receiptDirectory, 'pre-destructive.actions'))
    );
    await assert.rejects(
      readFile(join(receiptDirectory, 'pre-destructive.json'))
    );
  } finally {
    await chmod(atJobs, 0o1770);
    await rm(directory, { recursive: true, force: true });
  }
});
