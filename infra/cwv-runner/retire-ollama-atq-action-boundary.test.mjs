import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);

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
