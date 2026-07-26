import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (name) => readFile(new URL(name, import.meta.url), 'utf8');
const section = (source, startMarker, endMarker) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `missing start marker: ${startMarker}`);
  assert.ok(end > start, `missing end marker: ${endMarker}`);
  return source.slice(start, end);
};
const assertInOrder = (source, markers) => {
  let previous = -1;
  for (const marker of markers) {
    const current = source.indexOf(marker, previous + 1);
    assert.ok(current >= 0, `missing ordered marker: ${marker}`);
    assert.ok(current > previous, `out-of-order marker: ${marker}`);
    previous = current;
  }
};

test('campaign requires an empty reviewed cron tree before freezing and stopping cron', async () => {
  const [source, inventory] = await Promise.all([
    read('./campaign-quiesce.sh'),
    read('./cron-inventory.json'),
  ]);
  assert.deepEqual(JSON.parse(inventory).activeCronProcessTrees, []);
  for (const required of [
    'capture_cron_trees',
    'verify_cron_trees',
    'activeCronProcessTrees',
    'commandSha256',
    'parentStartTime',
    'rootPid',
    'depth',
    'cron-tree-final.json',
    'freeze-cron-tree',
    'cron-tree-records.json',
    'capture-cron-trees',
  ])
    assert.match(
      source,
      new RegExp(required.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    );
  const campaign = section(
    source,
    '\ncase "$mode" in campaign|rehearsal)',
    '\n;; esac'
  );
  const freeze = section(
    source,
    '\nfreeze_cron_tree() {',
    '\nsnapshot_resources() {'
  );
  assertInOrder(campaign, [
    'activeCronProcessTrees | type == "array" and length == 0',
    'capture_cron_trees',
    'verify_cron_trees',
    'freeze_cron_tree',
    'cron-tree-final.json',
    'systemctl stop cron.service',
    'journal stop-unit cron.service',
  ]);
  assertInOrder(freeze, [
    'systemctl kill --kill-who=all --signal=STOP cron.service',
    'cron-tree-candidate.json',
    '"$CRON_CONTRACT" merge',
    'cron-tree-final.json',
  ]);
  assert.match(source, /new cron descendant appeared during freeze/);
  assert.match(
    source,
    /cron process (?:identity|replacement|reparented|tree drift)/
  );
  assert.doesNotMatch(source, /pkill|killall/);
  assert.doesNotMatch(source, /\/bin\/kill -(?:TERM|KILL) "\$pid"/);
  assert.match(
    source,
    /usage: campaign-quiesce\.sh <prepare\|registration\|campaign\|rehearsal> <transaction-id>/
  );
  assert.doesNotMatch(
    campaign,
    /pgrep -P "\$pid"|\/bin\/kill -TERM "\$pid"/,
    'captured runner processes must be stopped through their proven systemd units'
  );
  assert.match(
    campaign,
    /systemctl stop "\$unit"[\s\S]*pgrep -f 'Runner\\\.Listener\|Runner\\\.Worker'/,
    'runner units must stop before the global survivor refusal'
  );
});

test('campaign refuses every reviewed cron descendant before any signal', async () => {
  const source = await read('./campaign-quiesce.sh');
  const campaign = section(
    source,
    '\ncase "$mode" in campaign|rehearsal)',
    '\n;; esac'
  );
  assert.match(source, /activeCronProcessTrees\s*\|[\s\S]*length\s*==\s*0/);
  assert.ok(
    campaign.indexOf('activeCronProcessTrees') <
      campaign.indexOf('/bin/systemctl stop cron.service')
  );
  assert.doesNotMatch(campaign, /kill --kill-who=all/);
});

test('executes the cron PID parser and watchdog lease separator as valid awk and jq', async () => {
  const source = await read('./campaign-quiesce.sh');
  const awk = /\/usr\/bin\/awk '([^']+)'/.exec(source)?.[1];
  const join = /join\(([^)]+)\)/.exec(source)?.[1];
  assert.ok(awk && join);
  assert.equal(
    execFileSync('/usr/bin/awk', [awk], {
      input:
        '123 (cron worker) S 77 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20\n',
    })
      .toString()
      .trim(),
    '77:20'
  );
  assert.equal(
    execFileSync('/usr/bin/jq', ['-nr', `[7,9]|join(${join})`])
      .toString()
      .trim(),
    '7:9'
  );
});
