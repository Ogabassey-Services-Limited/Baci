import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { buildCompleteAccountingIdentity } from './exact-run-accounting.mjs';

const hash = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
const COUNTERS = [
  'forwarded-ingress',
  'measurement-ingress',
  'host-local-ingress',
  'forwarded-egress',
  'measurement-egress',
  'host-originated-egress',
];
const BASE_COUNTERS = COUNTERS.filter((name) => name !== 'measurement-ingress');

const iif = (name) => ({
  match: { op: '==', left: { meta: { key: 'iifname' } }, right: name },
});
const oif = (name) => ({
  match: { op: '==', left: { meta: { key: 'oifname' } }, right: name },
});
const mark = (value) => ({
  match: { op: '==', left: { ct: { key: 'mark' } }, right: value },
});
const counter = (bytes = 0) => ({ counter: { bytes, packets: 0 } });
const nonLocalDestination = () => ({
  match: {
    op: '!=',
    left: { fib: { flags: ['daddr'], result: 'type' } },
    right: 'local',
  },
});
const hostOrigin = (op) => ({
  match: { op, left: { meta: { key: 'iif' } }, right: 0 },
});

function fixture() {
  const campaignId = 'baci-cwv-1';
  const runtime = {
    campaignMark: 37,
    externalInterface: 'eth0',
    runnerVeth: 'veth0',
  };
  const handles = Object.fromEntries(
    BASE_COUNTERS.map((name, index) => [name, index + 10])
  );
  const completeHandles = {
    ...handles,
    'classify-measurement': 15,
    'measurement-ingress': 16,
  };
  const baseProjection = {
    schemaVersion: 1,
    family: 'inet',
    table: 'baci_cwv',
    tableHandle: 1,
    chainHandles: {
      classify: 2,
      external_egress: 5,
      external_ingress: 3,
      host_external_egress: 6,
      host_external_ingress: 4,
    },
    campaignMark: runtime.campaignMark,
    externalInterface: runtime.externalInterface,
    runnerInterface: null,
    readyForSampling: false,
    handles,
  };
  const base = {
    ...baseProjection,
    counters: {},
    identitySha256: hash(baseProjection),
  };
  const prefix = `baci-cwv:${campaignId}:`;
  const rule = (name, chain, expr) => ({
    rule: {
      chain,
      comment: `${prefix}${name}`,
      expr,
      family: base.family,
      handle: completeHandles[name],
      table: base.table,
    },
  });
  const rules = [
    rule('forwarded-ingress', 'external_ingress', [
      iif(runtime.externalInterface),
      nonLocalDestination(),
      counter(101),
    ]),
    rule('host-local-ingress', 'host_external_ingress', [
      iif(runtime.externalInterface),
      counter(103),
    ]),
    rule('forwarded-egress', 'external_egress', [
      oif(runtime.externalInterface),
      hostOrigin('!='),
      counter(104),
    ]),
    rule('measurement-egress', 'external_egress', [
      oif(runtime.externalInterface),
      hostOrigin('!='),
      mark(runtime.campaignMark),
      counter(105),
    ]),
    rule('host-originated-egress', 'host_external_egress', [
      oif(runtime.externalInterface),
      hostOrigin('=='),
      counter(106),
    ]),
    rule('classify-measurement', 'classify', [
      iif(runtime.runnerVeth),
      oif(runtime.externalInterface),
      { mangle: { key: { ct: { key: 'mark' } }, value: runtime.campaignMark } },
    ]),
    rule('measurement-ingress', 'external_ingress', [
      iif(runtime.externalInterface),
      oif(runtime.runnerVeth),
      mark(runtime.campaignMark),
      counter(102),
    ]),
  ];
  return {
    base,
    campaignId,
    nft: {
      nftables: [
        { metainfo: { json_schema_version: 1 } },
        {
          table: {
            family: base.family,
            handle: base.tableHandle,
            name: base.table,
          },
        },
        {
          chain: {
            family: base.family,
            handle: 2,
            hook: 'forward',
            name: 'classify',
            policy: 'accept',
            prio: -150,
            table: base.table,
            type: 'filter',
          },
        },
        {
          chain: {
            family: base.family,
            handle: 3,
            hook: 'forward',
            name: 'external_ingress',
            policy: 'accept',
            prio: 0,
            table: base.table,
            type: 'filter',
          },
        },
        {
          chain: {
            family: base.family,
            handle: 4,
            hook: 'input',
            name: 'host_external_ingress',
            policy: 'accept',
            prio: 0,
            table: base.table,
            type: 'filter',
          },
        },
        {
          chain: {
            family: base.family,
            handle: 5,
            hook: 'postrouting',
            name: 'external_egress',
            policy: 'accept',
            prio: 0,
            table: base.table,
            type: 'filter',
          },
        },
        {
          chain: {
            family: base.family,
            handle: 6,
            hook: 'postrouting',
            name: 'host_external_egress',
            policy: 'accept',
            prio: 0,
            table: base.table,
            type: 'filter',
          },
        },
        ...rules,
      ],
    },
    runtime,
  };
}

test('builds an exact ready accounting identity from the controller inventory', () => {
  const value = fixture();
  const result = buildCompleteAccountingIdentity(value);
  assert.equal(result.readyForSampling, true);
  assert.equal(result.runnerInterface, value.runtime.runnerVeth);
  assert.deepEqual(result.counters, {
    forwardedIngress: 101,
    forwardedEgress: 104,
    hostLocalIngress: 103,
    hostOriginatedEgress: 106,
    measurementEgress: 105,
    measurementIngress: 102,
  });
  assert.match(result.identitySha256, /^[a-f0-9]{64}$/);
});

test('refuses an inventory whose named rules are all placed in an attacker chain', () => {
  const value = fixture();
  for (const entry of value.nft.nftables) {
    if (entry.rule) entry.rule.chain = 'attacker-chain';
  }
  assert.throws(() => buildCompleteAccountingIdentity(value), /accounting/);
});

test('refuses a classifier whose expression only mentions the expected bindings', () => {
  const value = fixture();
  const classifier = value.nft.nftables.find((entry) =>
    entry.rule?.comment.endsWith(':classify-measurement')
  ).rule;
  classifier.expr = [
    {
      match: {
        op: '==',
        left: { payload: { field: 'saddr', protocol: 'ip' } },
        right: value.runtime.runnerVeth,
      },
    },
    {
      match: {
        op: '==',
        left: { payload: { field: 'daddr', protocol: 'ip' } },
        right: value.runtime.externalInterface,
      },
    },
    {
      match: {
        op: '==',
        left: { payload: { field: 'length', protocol: 'ip' } },
        right: value.runtime.campaignMark,
      },
    },
  ];
  assert.throws(
    () => buildCompleteAccountingIdentity(value),
    /accounting rule semantic drift/
  );
});
