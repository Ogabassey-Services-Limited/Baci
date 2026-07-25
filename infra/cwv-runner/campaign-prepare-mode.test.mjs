import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [source, restore] = await Promise.all([
  readFile(new URL('./campaign-quiesce.sh', import.meta.url), 'utf8'),
  readFile(new URL('./campaign-restore.sh', import.meta.url), 'utf8'),
]);

test('prepare captures and arms the watchdog without mutating production state', () => {
  const mutationBlock = source.slice(
    source.indexOf('case "$mode" in campaign|rehearsal)'),
    source.indexOf('if [ "$mode" = campaign ]; then')
  );
  assert.ok(mutationBlock.length > 0);
  for (const token of [
    'freeze_cron_tree',
    'activeCronProcessTrees | type == "array" and length == 0',
    'systemctl stop cron.service',
    'systemctl stop "$unit"',
    'systemctl set-property --runtime',
    'docker stop',
    'docker update',
  ])
    assert.match(mutationBlock, new RegExp(token.replaceAll('$', '\\$')));
  assert.match(
    source,
    /if \[ "\$mode" = prepare \]; then verify_production_unchanged; fi/
  );
  assert.match(source, /create-capture/);
  assert.match(source, /enable --now "\$watchdog"/);
  assert.doesNotMatch(mutationBlock, /prepare/);
});

test('prepare watchdog recovery stops the isolated runtime after a partial start', () => {
  const cleanup = restore.slice(
    restore.indexOf('remove_dedicated_runtime() {'),
    restore.indexOf('cleanup_terminal_mode() {')
  );
  assert.match(cleanup, /case "\$mode" in campaign\|registration\|prepare\)/);
  assert.doesNotMatch(
    cleanup,
    /receipt_owns start-dedicated-unit \|\| continue/
  );
  assert.doesNotMatch(cleanup, /docker\.service|containerd\.service/);
});

test('prepare recovery purges unaccepted content only after runtime quiescence', () => {
  const cleanup = restore.slice(
    restore.indexOf('cleanup_prepare_content() {'),
    restore.indexOf('restore_resources() {')
  );
  assert.match(cleanup, /target-accepted/);
  assert.ok(
    cleanup.indexOf('verify_runtime_quiet') <
      cleanup.indexOf('"$PREPARE_CONTENT_CLEANUP" cleanup')
  );
  assert.ok(
    restore.lastIndexOf('remove_dedicated_runtime') <
      restore.lastIndexOf('cleanup_prepare_content')
  );
});

test('prepare recovery repairs accepted root receipts before staging cleanup', () => {
  assert.match(restore, /repair_prepare_acceptance\(\)/);
  assert.match(restore, /target-accepted/);
  assert.ok(
    restore.lastIndexOf('repair_prepare_acceptance') <
      restore.lastIndexOf('cleanup_terminal_mode')
  );
});

test('campaign stops every captured runner unit without signaling captured pids', () => {
  const runnerStart = source.indexOf('.priorState.resources.runners[]');
  const runnerStop = source.slice(
    runnerStart,
    source.indexOf('.priorState.resources.timers[]', runnerStart)
  );
  const shutdown = source.slice(
    runnerStart,
    source.indexOf('systemctl set-property --runtime', runnerStart)
  );
  assert.match(runnerStop, /\.priorState\.resources\.runners\[\] \| \.id/);
  assert.match(runnerStop, /systemctl stop "\$unit"/);
  assert.doesNotMatch(runnerStop, /select\(\.active\)/);
  assert.match(shutdown, /pgrep -f 'Runner\\\.Listener\|Runner\\\.Worker'/);
  assert.doesNotMatch(shutdown, /\/bin\/kill|pgrep -P/);
});

test('runtime quiet verification accepts shims outside the service cgroup', () => {
  const verification = restore.slice(
    restore.indexOf('verify_service_empty() {'),
    restore.indexOf('verify_runtime_quiet() {')
  );
  assert.match(
    verification,
    /for shim_pid[\s\S]*grep -Fq[\s\S]*done\n\s*return 0\n}/
  );
});
