import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createAccountingIdentity } from './campaign-accounting-contract.mjs';
import {
  createNetworkSnapshot,
  networkInventoryNames,
  stableNetworkInventoryNames,
  verifyNetworkSnapshot,
  verifyStableNetworkSnapshot,
} from './campaign-network-contract.mjs';
import { validateAccounting } from './campaign-restore-network.mjs';

const read = (name) => readFile(new URL(name, import.meta.url), 'utf8');

test('campaign persists intent and applied ownership around every mutation', async () => {
  const source = await read('./campaign-quiesce.sh');
  for (const [intent, mutation, applied] of [
    ['ownership network-intent', 'network create', 'ownership network-applied'],
    ['ownership accounting-intent', 'nft -f', 'ownership accounting-applied'],
  ]) {
    const before = source.indexOf(intent);
    const change = source.indexOf(mutation, before);
    const after = source.indexOf(applied, change);
    assert.ok(before >= 0 && before < change && change < after, mutation);
  }
  assert.match(
    source,
    /owned_iptables_mutation\(\).*ownership isolation-intent.*\/usr\/sbin\/iptables "\$@".*ownership isolation-applied/s
  );
  assert.match(source, /owned_iptables_mutation input-chain/);
  assert.doesNotMatch(source, /(?:^|\n)iptables_mutation\(\)/);
});

test('accounting deletion requires exact table, chains, rules, expressions, and comments', () => {
  const chain = {
    family: 'inet',
    table: 'baci_cwv',
    name: 'ingress',
    type: 'filter',
    hook: 'forward',
    prio: 10,
    policy: 'accept',
    handle: 2,
  };
  const rule = {
    family: 'inet',
    table: 'baci_cwv',
    chain: 'ingress',
    expr: [{ counter: { packets: 0, bytes: 0 } }],
    comment: 'baci-cwv:tx:ingress',
    handle: 3,
  };
  const current = {
    nftables: [
      { table: { family: 'inet', name: 'baci_cwv', handle: 1 } },
      { chain },
      { rule },
    ],
  };
  const plan = {
    schemaVersion: 1,
    family: 'inet',
    table: 'baci_cwv',
    campaignMark: 9,
    externalInterface: 'eth0',
    runnerInterface: null,
    readyForSampling: false,
    chains: [
      {
        name: 'ingress',
        type: 'filter',
        hook: 'forward',
        prio: 10,
        policy: 'accept',
      },
    ],
    rules: [
      {
        chain: 'ingress',
        comment: 'baci-cwv:tx:ingress',
        expr: [{ counter: true }],
      },
    ],
  };
  const identity = createAccountingIdentity(plan, current);
  assert.doesNotThrow(() => validateAccounting({ identity, current }));
  assert.throws(
    () =>
      validateAccounting({
        identity,
        current: {
          nftables: [
            ...current.nftables,
            { rule: { ...rule, handle: 4, comment: 'foreign' } },
          ],
        },
      }),
    /accounting generation mismatch/
  );
  assert.throws(
    () =>
      validateAccounting({
        identity,
        current: {
          nftables: [
            current.nftables[0],
            { chain: { ...chain, hook: 'input' } },
            { rule: { ...rule, comment: 'foreign' } },
          ],
        },
      }),
    /accounting generation mismatch/
  );
});

test('capture retains all inventories while restore hashes only stable configuration', async () => {
  const bytes = Object.fromEntries(
    networkInventoryNames.map((name, index) => [name, Buffer.from(`${index}`)])
  );
  const snapshot = createNetworkSnapshot({
    campaignMark: 9,
    externalInterface: { name: 'eth0', ifindex: 2 },
    inventoryBytes: bytes,
  });
  assert.deepEqual(verifyNetworkSnapshot(snapshot, bytes), snapshot);
  const stable = Object.fromEntries(
    stableNetworkInventoryNames.map((name) => [name, bytes[name]])
  );
  assert.doesNotThrow(() => verifyStableNetworkSnapshot(snapshot, stable));
  const stableDrift = structuredClone(stable);
  stableDrift.iptables = Buffer.from('drift');
  assert.throws(
    () => verifyStableNetworkSnapshot(snapshot, stableDrift),
    /stable network baseline mismatch/
  );
  for (const name of networkInventoryNames)
    assert.throws(
      () =>
        verifyNetworkSnapshot(snapshot, {
          ...bytes,
          [name]: Buffer.from('drift'),
        }),
      /complete network baseline mismatch/
    );
  assert.throws(
    () =>
      createNetworkSnapshot({
        campaignMark: 9,
        externalInterface: { name: 'eth0', ifindex: 2 },
        inventoryBytes: { ...bytes, extra: Buffer.from('foreign') },
      }),
    /complete network baseline mismatch/
  );
  const [quiesce, baseline] = await Promise.all([
    read('./campaign-quiesce.sh'),
    read('./campaign-restore-baseline.mjs'),
  ]);
  assert.match(quiesce, /campaign-network-contract\.mjs/);
  assert.match(baseline, /campaign-network-contract\.mjs/);
  assert.match(baseline, /verifyStableNetworkSnapshot/);
  assert.doesNotMatch(
    baseline,
    /(?:nf_conntrack|\/usr\/sbin\/nft|\/usr\/sbin\/tc)/
  );
  assert.doesNotMatch(quiesce, /jq -S .*network-base\.json/);
});
