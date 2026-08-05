import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import * as state from './campaign-state.mjs';

const read = (name) => readFile(new URL(name, import.meta.url), 'utf8');
const matchAll = (source, patterns) => {
  for (const pattern of patterns) assert.match(source, pattern);
};
const assertBefore = (source, before, after) => {
  const left = source.indexOf(before);
  const right = source.indexOf(after);
  assert.ok(left >= 0, `missing ordering marker: ${before}`);
  assert.ok(right >= 0, `missing ordering marker: ${after}`);
  assert.ok(left < right, `${before} must precede ${after}`);
};

// biome-ignore format: keep the static contract matrix below the modularity ceiling
test('quiesce is fail-closed, installs rollback first, and preserves applications', async () => {
  const source = await read('./campaign-quiesce.sh');
  matchAll(source, [
    /SCRIPT_DIR=/, /prepare\|registration\|campaign\|rehearsal/,
    /trap restore_on_exit EXIT HUP INT TERM/, /\/run\/lock\/baci-cwv-campaign\.lock/,
    /actions\\\.runner/, /Runner\\\.Listener/, /\/proc\/\$pid\/cgroup/,
    /measurement_cpu_set=\$\(policy \/resources\/measurementCpuSet\)/, /other_cpu_set=\$\(policy \/resources\/otherCpuSet\)/,
    /cwv-measurement\.slice.*AllowedCPUs=\$measurement_cpu_set/s, /system\.slice.*AllowedCPUs=\$other_cpu_set/s,
    /docker.*update.*--cpuset-cpus "\$other_cpu_set"/s, /watchdog\.env/,
    /TRANSACTION_ID.*MODE.*CAPTURE_SHA.*SOURCE_DIGEST.*CREATION_BOOT_ID.*UTC_DEADLINE.*MONOTONIC_DEADLINE/s,
  ]);
  assert.doesNotMatch(source, /\/srv\/baci-cwv\/bin|\/current\//);
  assert.match(source, /restore_on_exit[\s\S]*rm -rf[\s\S]*"\$RESTORE"/);
  assertBefore(source, 'trap restore_on_exit', '\ncapture_host_state\n');
  assertBefore(source, 'watchdog.env', 'systemctl enable --now');
  assert.doesNotMatch(source, /watchdog\.env[^\n]*(token|secret|credential)/i);
  assert.doesNotMatch(
    source,
    /docker[^\n]*\bstop\b[^\n]*(application|app-container)/i
  );
  assert.doesNotMatch(
    source,
    /sysctl\s+-w|\/proc\/sys\/net\/ipv4\/ip_forward\s*>/
  );
});
test('restore trusts the immutable capture and performs reverse idempotent reconciliation', async () => {
  const source = await read('./campaign-restore.sh');
  const postCommit = await read('./campaign-restore-post-commit.sh');
  assert.match(source, /SCRIPT_DIR=/);
  assert.doesNotMatch(source, /\/srv\/baci-cwv\/bin|\/current\//);
  assert.match(source, /usage:.*transaction-id.*capture-sha256/i);
  assert.match(source, /verify-capture/);
  assert.match(source, /capture-derived-mode/);
  assert.match(source, /resources\.slices \| reverse\[\]/);
  assert.match(source, /inspectProgress/);
  assert.match(source, /restored\.json/);
  // biome-ignore format: keeps this static contract within the test-file ceiling.
  assert.doesNotMatch(`${source}\n${postCommit}`, /systemctl stop "baci-cwv-campaign-watchdog@/);
  assert.match(postCommit, /systemctl disable "baci-cwv-campaign-watchdog@/);
  assert.doesNotMatch(source, /\$\{?MODE\}?/);
});
test('campaign state paths are root-private and restore has one atomic owner', async () => {
  const [quiesce, restore, watchdog] = await Promise.all([
    read('./campaign-quiesce.sh'),
    read('./campaign-restore.sh'),
    read('./campaign-watchdog.sh'),
  ]);
  for (const source of [quiesce, restore, watchdog]) {
    assert.match(source, /assert_private_state_directory/);
    assert.match(source, /stat -c '%u:%a'/);
    assert.match(source, /secure campaign state directory/);
  }
  assert.match(restore, /flock -n 8/);
  assert.match(restore, /another restore owns this transaction/);
  assertBefore(restore, 'restore.lock', 'stop_measurement');
});
test('Ollama retirement is scan-first, identity-bound, and never emits raw environment values', async () => {
  const source = await read('./retire-ollama.sh');
  const consumers = await read('./retire-ollama-consumers.sh');
  assert.match(source, /--scan/);
  assert.match(source, /--apply/);
  assert.match(
    source,
    /a57aee33c02252e61943639c292e96a695ee75a33d92f730fd1be830a67a747b/
  );
  assert.match(
    source,
    /603d5005ad4f7b7d8c535be7ac8b8379b69a83b550014a56b2dfa6bbdb51ba8f/
  );
  assert.match(
    source,
    /4cee5cdc723001694bc0d2ea22be4db9ff91a1df5f969dc95d2483f55900519d/
  );
  assert.match(
    source,
    /3b27b446d253183977b01ea6e94c09a0d5bb4ac7d2414ad162ddd7fb49a6fc81/
  );
  assert.match(source, /normalized-value-sha256/);
  assert.doesNotMatch(source, /printenv|\/proc\/[^ ]*\/environ/);
  assert.match(source, /scan_container_rows\(\).*load_consumer_scanners/);
  assert.match(consumers, /json \.Config\.Env/);
  assert.doesNotMatch(source, /command=.*sha256sum/);
  assert.match(source, /while IFS= read -r line/);
});
test('watchdog resolves only sibling receipt-bound scripts', async () => {
  const source = await read('./campaign-watchdog.sh');
  assert.match(source, /SCRIPT_DIR=/);
  assert.match(source, /STATE_TOOL="\$SCRIPT_DIR\/campaign-state\.mjs"/);
  assert.match(source, /RESTORE="\$SCRIPT_DIR\/campaign-restore\.sh"/);
  assert.doesNotMatch(source, /\/srv\/baci-cwv\/bin|\/current\//);
});
test('inventories are closed, reviewed, and pause every surviving cron command', async () => {
  const cron = JSON.parse(await read('./cron-inventory.json'));
  const ollama = JSON.parse(await read('./ollama-active-inventory.json'));
  assert.equal(cron.schemaVersion, 1);
  assert.equal(
    cron.expectedCrontabSha256,
    '603d5005ad4f7b7d8c535be7ac8b8379b69a83b550014a56b2dfa6bbdb51ba8f'
  );
  assert.deepEqual(cron.activeCrontabLines, []);
  assert.ok(
    cron.entries.every((entry) => entry.campaignDisposition === 'pause')
  );
  // biome-ignore format: keep the closed inventory derivation within the test-file ceiling.
  const runnerRoots = cron.entries.filter((entry) => entry.kind === 'runner-root').map((entry) => entry.path).sort();
  // biome-ignore format: keep the absence and canonical replacement adjacent.
  assert.deepEqual([cron.runnerRoots, runnerRoots], [undefined, ['/home/bassey/actions-runner-cleancontacts-deploy', '/home/bassey/actions-runners/baci-deploy-2']]);
  assert.ok(ollama.schemaVersion >= 1);
  assert.deepEqual(ollama.approvedEndpointClasses, [
    'disabled',
    'external-provider',
    'ollama-loopback',
  ]);
  assert.equal(ollama.reviewStatus, 'pending-privileged-scan');
});
test('prior state binds exact reversible resource and network values', () => {
  assert.equal(typeof state.validatePriorState, 'function');
  const prior = {
    schemaVersion: 1,
    cron: {
      sha256: 'a'.repeat(64),
      archiveSha256: 'b'.repeat(64),
      archivePath: '/srv/baci-cwv/campaigns/tx/crontab.before',
      serviceActive: true,
      serviceEnabled: true,
    },
    resources: {
      runners: [{ id: 'runner.service', active: true, runnerRoot: '/runner' }],
      timers: [{ id: 'apt.timer', active: true, enabled: false }],
      containers: [
        { id: 'abc', running: true, cpuset: '0-3', role: 'application' },
      ],
      slices: [{ id: 'system.slice', allowedCpus: '0-3' }],
    },
    network: {
      ipForward: 1,
      campaignMark: 0xb1234567,
      collisions: [],
      accountingTablePresent: false,
      baselineSha256: 'c'.repeat(64),
      externalInterface: { name: 'eth0', ifindex: 2 },
      inventories: Object.fromEntries(
        [
          'nftables',
          'iptables',
          'ip6tables',
          'ipRules4',
          'ipRules6',
          'tc',
          'conntrack',
          'addresses',
          'routes',
          'dockerNetworks',
        ].map((key) => [key, 'd'.repeat(64)])
      ),
    },
  };

  assert.doesNotThrow(() => state.validatePriorState(prior));
  assert.throws(
    () =>
      state.validatePriorState({
        ...prior,
        resources: { ...prior.resources, containers: [{ id: 'abc' }] },
      }),
    /complete prior state/
  );
  const { addresses: _addresses, ...incompleteInventories } =
    prior.network.inventories;
  assert.throws(
    () =>
      state.validatePriorState({
        ...prior,
        network: { ...prior.network, inventories: incompleteInventories },
      }),
    /complete prior state/
  );
  assert.throws(
    () =>
      state.validatePriorState({
        ...prior,
        cron: { ...prior.cron, archivePath: '' },
      }),
    /complete prior state/
  );
});

test('host control captures every reversible resource and collision authority before mutation', async () => {
  const source = await read('./campaign-quiesce.sh');
  for (const required of [
    'systemctl show',
    'AllowedCPUs',
    'docker inspect',
    'CpusetCpus',
    'nft list ruleset',
    'iptables-save',
    'ip6tables-save',
    'ip -json -4 rule',
    'ip -json -6 rule',
    'tc -json filter',
    '/proc/net/nf_conntrack',
    'ip -json address',
    'ip -json route',
    'docker network inspect',
    'capture.json',
  ]) {
    assert.match(
      source,
      new RegExp(required.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    );
  }
  assertBefore(
    source,
    'nft list ruleset',
    'case "$mode" in campaign|rehearsal)'
  );
  assertBefore(source, 'create-capture', 'case "$mode" in campaign|rehearsal)');
});

test('host control journals accounting and isolation install while restore uses captured exact values', async () => {
  const quiesce = await read('./campaign-quiesce.sh');
  const restore = await read('./campaign-restore.sh');
  const restoreNetwork = await read('./campaign-restore-network.mjs');
  assert.match(quiesce, /ACCOUNTING_BASE_NFT/);
  assert.match(quiesce, /add table/);
  assert.match(quiesce, /systemctl start baci-cwv-containerd\.service/);
  assert.match(quiesce, /systemctl start baci-cwv-docker\.service/);
  assert.match(quiesce, /docker.*network create/);
  assert.match(quiesce, /iptables.*-I INPUT 1/);
  assert.match(quiesce, /iptables.*-I DOCKER-USER 1/);
  assert.match(quiesce, /iptables.*-I POSTROUTING 1/);
  assert.match(quiesce, /journal.*install-accounting/);
  assert.match(quiesce, /journal.*install-isolation/);
  assert.match(restore, /delete table/);
  assert.match(restore, /rollback-isolation/);
  assert.match(restoreNetwork, /DOCKER-USER/);
  assert.match(restoreNetwork, /POSTROUTING/);
  assert.match(restore, /allowedCpus/);
  assert.match(restore, /cpuset/);
  assert.match(restore, /archivePath/);
  assert.match(restore, /timers/);
  assert.match(restore, /runners/);
});
test('host transaction keeps its exclusive lease held by a proven terminal holder before mutation', async () => {
  const source = await read('./campaign-quiesce.sh');
  assert.match(source, /watchdog-ready\.json/);
  assert.match(source, /lockOwnerPid.*watchdogPid/);
  assert.match(source, /lockDevice.*lockInode/);
  assert.match(source, /\/proc\/\$watchdog_pid/);
  assert.doesNotMatch(source, /exec 9>&-/);
  assertBefore(
    source,
    'lease holder did not prove inherited campaign lock',
    'case "$mode" in campaign|rehearsal)'
  );
  assert.match(source, /baseline.*drift|drift.*baseline/);
});
test('host transaction refuses collisions, installs exact isolation, and pauses only captured work', async () => {
  const source = await read('./campaign-quiesce.sh');
  // biome-ignore format: compact static contract inventory
  matchAll(source, [
    /collision audit/, /docker network inspect/, /iptables-save/, /deniedDestinationCidrs/,
    /ESTABLISHED,RELATED/, /cron-inventory\.json/, /Runner\.Worker/, /systemctl stop "\$unit"/,
  ]);
  assertBefore(source, 'baseline', 'iptables_mutation input-chain');
  matchAll(source, [
    /case "\$mode" in prepare\|registration\|campaign\|rehearsal\)/,
    /if \[ "\$mode" = prepare \]; then verify_production_unchanged; fi/,
    /case "\$mode" in campaign\|rehearsal\)/,
    /if \[ "\$mode" = campaign \]; then[\s\S]*create --driver bridge/,
  ]);
  const prepareStart = source.indexOf('if [ "$mode" = prepare ]');
  const campaignStart = source.indexOf('case "$mode" in campaign|rehearsal');
  assert.ok(prepareStart >= 0 && campaignStart > prepareStart);
  assert.doesNotMatch(
    source.slice(prepareStart, campaignStart),
    /iptables|network create|systemctl stop/
  );
  assert.match(source, /journal create-network/);
  assert.match(source, /journal install-isolation/);
});
