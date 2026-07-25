import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { rollbackIsolation } from './campaign-ownership.mjs';
import { validateNetwork } from './campaign-restore-network.mjs';

const restoreSource = await readFile(
  new URL('./campaign-restore.sh', import.meta.url),
  'utf8'
);
const postCommitSource = await readFile(
  new URL('./campaign-restore-post-commit.sh', import.meta.url),
  'utf8'
);
const source = `${restoreSource}\n${postCommitSource}`;
const verifier = await readFile(
  new URL('./campaign-restore-network.mjs', import.meta.url),
  'utf8'
);
const baseline = await readFile(
  new URL('./campaign-restore-baseline.mjs', import.meta.url),
  'utf8'
);
const networkContract = await readFile(
  new URL('./campaign-network-contract.mjs', import.meta.url),
  'utf8'
);

test('restore requires a capture-bound progressive ownership receipt before deletion', () => {
  assert.match(source, /ownership\.json/);
  assert.match(verifier, /assertOwnershipReceipt/);
  assert.match(verifier, /baselineSha256/);
  assert.match(verifier, /baci\.cwv\.transaction/);
  assert.ok(
    source.indexOf('assert_campaign_ownership') <
      source.indexOf('remove_accounting')
  );
  assert.match(source, /journal-inspection-unavailable/);
  assert.doesNotMatch(source, /anomalies == \[\]/);
});

test('restore delegates exact reverse isolation rollback without masked deletes', () => {
  const cleanup = source.slice(
    source.indexOf('remove_accounting() {'),
    source.indexOf('cleanup_prepare_content() {')
  );
  assert.match(cleanup, /rollback-isolation/);
  assert.doesNotMatch(cleanup, /iptables .*-[DFX].*2>\/dev\/null \|\| :/);
  assert.ok(cleanup.indexOf('accounting') < cleanup.indexOf('nft delete'));
  assert.ok(cleanup.indexOf('network') < cleanup.indexOf('network rm'));
});

test('accounting final evidence is durable before deletion and bound into recovery', () => {
  const capture = source.indexOf('accounting.final.tmp');
  const hash = source.indexOf('accounting_final_sha=$(hash_file');
  const checkpoint = source.indexOf('write_accounting_checkpoint');
  const deletion = source.indexOf('nft delete table');
  assert.ok(
    capture >= 0 && hash > capture && checkpoint > hash && deletion > checkpoint
  );
  assert.match(source, /accountingFinalSha256/);
  assert.match(source, /reconciled:false/);
  assert.match(source, /reconciled:true/);
  assert.match(source, /accounting terminal recovery required/);
  assert.ok(
    source.lastIndexOf('restored.json")') <
      source.lastIndexOf('release_lease_holder')
  );
  assert.match(source, /lease-release\.json/);
  assert.match(source, /lease-holder\.json/);
});

test('restored receipt records measured residue and durably reports post-commit cleanup failures', () => {
  for (const field of [
    'accountingTablePresent',
    'transactionContainerCount',
    'dedicatedNetworkPresent',
    'dedicatedServicesActive',
    'ownedFirewallPresent',
    'samplerActive',
  ])
    assert.match(source, new RegExp(`--argjson ${field} `));
  assert.doesNotMatch(source, /accountingTablePresent:false/);
  assert.doesNotMatch(source, /transactionContainerCount:0/);
  assert.doesNotMatch(source, /dedicatedNetworkPresent:false/);
  assert.doesNotMatch(source, /dedicatedServicesActive:false/);
  assert.doesNotMatch(source, /ownedFirewallPresent:false/);
  assert.doesNotMatch(source, /samplerActive:false/);
  assert.match(source, /restore-post-commit-failed\.json/);
  assert.match(source, /reconciled:true/);
  const postCommit = source.slice(source.indexOf('post_commit_cleanup() {'));
  assert.match(
    postCommit,
    /release_lease_holder \|\| lease_holder_released=false/
  );
  assert.match(postCommit, /watchdog_disabled=true/);
  assert.match(postCommit, /environment_removed=true/);
  assert.match(postCommit, /\/bin\/chmod 0600/);
  assert.match(postCommit, /\/usr\/bin\/sync -f/);
  assert.ok(
    source.indexOf('release_lease_holder') <
      source.lastIndexOf('baci-cwv-campaign-watchdog')
  );
  assert.ok(
    source.lastIndexOf('baci-cwv-campaign-watchdog') <
      source.lastIndexOf('rm -f -- "$environment_file"')
  );
});

test('restored proof hashes stable baseline configuration and checks campaign residue separately', () => {
  for (const inventory of [
    'iptables',
    'ip6tables',
    'ipRules4',
    'ipRules6',
    'addresses',
    'routes',
    'dockerNetworks',
  ])
    assert.match(networkContract, new RegExp(inventory));
  assert.match(baseline, /verifyStableNetworkSnapshot/);
  assert.doesNotMatch(
    baseline,
    /(?:nf_conntrack|\/usr\/sbin\/nft|\/usr\/sbin\/tc)/
  );
  assert.match(baseline, /complete network baseline mismatch/);
  assert.match(
    baseline,
    /complete network baseline mismatch: \$\{error\.message\}/
  );
  assert.ok(
    source.indexOf('"$RESTORE_NETWORK" baseline') <
      source.lastIndexOf('verify_resource_state')
  );
});

test('Docker network removal requires exact labels and inspect identity', () => {
  const plan = {
    name: 'baci-cwv-net',
    gateway: '172.31.255.1',
    subnet: '172.31.255.0/28',
    bridge: 'baci-cwv0',
    labels: {
      'baci.cwv.capture': 'b'.repeat(64),
      'baci.cwv.transaction': 'tx',
    },
  };
  const row = {
    Id: 'a'.repeat(64),
    Name: plan.name,
    Created: '2026-07-22T00:00:00Z',
    Labels: plan.labels,
    IPAM: { Config: [{ Gateway: plan.gateway, Subnet: plan.subnet }] },
    Options: { 'com.docker.network.bridge.name': plan.bridge },
  };
  const current = Buffer.from(`${JSON.stringify([row])}\n`);
  const ownership = {
    network: { status: 'intent', plan, identity: null },
  };
  assert.doesNotThrow(() => validateNetwork({ ownership, current }));
  assert.throws(
    () =>
      validateNetwork({
        ownership,
        current: Buffer.from(
          `${JSON.stringify([{ ...row, Labels: { foreign: 'true' } }])}\n`
        ),
      }),
    /network identity mismatch/
  );
});

test('isolation rollback is deepest reverse and rejects extra chain rules', () => {
  const ownership = {
    isolation: {
      steps: [
        {
          id: 'chain',
          args: ['-N', 'BACI_CWV_INPUT'],
          status: 'applied',
          readbackSha256: 'a'.repeat(64),
        },
        {
          id: 'rule',
          args: ['-A', 'BACI_CWV_INPUT', '-j', 'REJECT'],
          status: 'applied',
          readbackSha256: 'b'.repeat(64),
        },
      ],
    },
  };
  const calls = [];
  const execute = (_file, args) => {
    calls.push(args);
    if (args[0] === '-C') return { status: 0, stdout: '' };
    if (args[0] === '-S') return { status: 0, stdout: '-N BACI_CWV_INPUT\n' };
    return { status: 0, stdout: '' };
  };
  rollbackIsolation(ownership, execute);
  assert.deepEqual(calls, [
    ['-C', 'BACI_CWV_INPUT', '-j', 'REJECT'],
    ['-D', 'BACI_CWV_INPUT', '-j', 'REJECT'],
    ['-S', 'BACI_CWV_INPUT'],
    ['-X', 'BACI_CWV_INPUT'],
  ]);
  assert.throws(
    () =>
      rollbackIsolation(ownership, (_file, args) => ({
        status: 0,
        stdout:
          args[0] === '-S'
            ? '-N BACI_CWV_INPUT\n-A BACI_CWV_INPUT -j ACCEPT\n'
            : '',
      })),
    /isolation identity mismatch/
  );

  const pending = structuredClone(ownership);
  pending.isolation.steps = [
    {
      id: 'chain',
      args: ['-N', 'BACI_CWV_INPUT'],
      status: 'intent',
      readbackSha256: null,
    },
  ];
  const pendingCalls = [];
  rollbackIsolation(pending, (_file, args) => {
    pendingCalls.push(args);
    return {
      status: 0,
      stdout: args[0] === '-S' ? '-N BACI_CWV_INPUT\n' : '',
    };
  });
  assert.deepEqual(pendingCalls, [
    ['-S', 'BACI_CWV_INPUT'],
    ['-X', 'BACI_CWV_INPUT'],
  ]);
});
