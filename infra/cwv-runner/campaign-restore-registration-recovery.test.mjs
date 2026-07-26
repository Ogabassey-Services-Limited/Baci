import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('./campaign-restore.sh', import.meta.url),
  'utf8'
);

test('reboot recovery deletes only receipt-bound transaction containers', () => {
  assert.match(source, /registration-container-created/);
  assert.match(source, /baci\.cwv\.transaction/);
  assert.match(source, /docker[^\n]+inspect/);
  assert.match(source, /containerId/);
  assert.match(source, /imageDigest/);
  assert.doesNotMatch(
    source,
    /ps -aq --filter label=baci\.cwv\.transaction=.*\|\s*\n\s*while/
  );
});

test('reboot recovery validates and unmounts the token layout before deletion', () => {
  assert.match(source, /registration-token-layout-created/);
  assert.match(source, /--validate/);
  assert.match(source, /\/usr\/bin\/umount/);
  assert.ok(source.indexOf('--validate') < source.indexOf('/usr/bin/umount'));
});

test('recovery arms a failure receipt before journal parsing and keeps its diagnostics', () => {
  const receipt = source.indexOf('trap write_failure_receipt EXIT');
  const captureMode = source.indexOf('capture_derived_mode=');
  const progress = source.indexOf('inspectProgress');
  assert.ok(receipt >= 0 && receipt < captureMode);
  assert.ok(receipt < progress);
  assert.match(source, /journal-inspection-unavailable/);
  assert.doesNotMatch(source, /anomalies == \[\]/);
  assert.ok(progress < source.indexOf('stop_measurement'));
});

test('recovery thaws and verifies every cron cgroup process before restoring cron', () => {
  const helpers = source.slice(
    source.indexOf('verify_cron_cgroup() {'),
    source.indexOf('assert_equal() {')
  );
  assert.match(helpers, /--signal=CONT/);
  assert.match(helpers, /\/proc\/\$pid\/status/);
  assert.match(helpers, /State:/);
  assert.match(helpers, /R\|S\|D\|I/);
  assert.match(helpers, /systemctl restart cron\.service/);
  assert.ok(
    source.lastIndexOf('restore_cron_service') <
      source.lastIndexOf('cleanup_terminal_mode')
  );
});

test('recovery restores the one policy-selected administrator crontab', () => {
  assert.match(source, /cron_user=\$\(policy \/host\/adminAccount\)/);
  assert.match(source, /crontab -u "\$cron_user" "\$archive_path"/);
  assert.match(source, /crontab -u "\$cron_user" -l/);
  assert.doesNotMatch(source, /crontab -u bassey/);
});
