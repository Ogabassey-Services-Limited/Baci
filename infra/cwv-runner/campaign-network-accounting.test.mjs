import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  createAccountingIdentity,
  createAccountingPlan,
} from './campaign-accounting-contract.mjs';

const source = await readFile(
  new URL('./campaign-quiesce.sh', import.meta.url),
  'utf8'
);
const policy = Object.freeze({
  family: 'inet',
  table: 'baci_cwv_measurement',
  classifyChain: 'classify',
  classifyHook: 'forward',
  classifyPriority: -150,
  ingressChain: 'external_ingress',
  hostIngressChain: 'host_external_ingress',
  ingressHook: 'forward',
  hostIngressHook: 'input',
  egressChain: 'external_egress',
  hostEgressChain: 'host_external_egress',
  egressHook: 'postrouting',
  counterPriority: 0,
});
const binding = Object.freeze({
  mark: 0xb6de43ae,
  external: 'eth0',
  runnerVeth: 'vethcwv0',
  transactionId: 'campaign-001',
  commentPrefix: 'baci-cwv:',
});
function heredoc(label) {
  const terminator = label.replaceAll("'", '');
  const match = new RegExp(`<<${label}\\n([\\s\\S]*?)\\n${terminator}`).exec(
    source
  );
  assert.ok(match, `missing ${label} artifact`);
  return match[1];
}
function renderRules() {
  const values = {
    family: policy.family,
    table: policy.table,
    classify_chain: policy.classifyChain,
    classify_hook: policy.classifyHook,
    classify_priority: policy.classifyPriority,
    ingress_chain: policy.ingressChain,
    host_ingress_chain: policy.hostIngressChain,
    ingress_hook: policy.ingressHook,
    host_ingress_hook: policy.hostIngressHook,
    egress_chain: policy.egressChain,
    host_egress_chain: policy.hostEgressChain,
    egress_hook: policy.egressHook,
    counter_priority: policy.counterPriority,
    campaign_mark_hex: '0xb6de43ae',
    external: binding.external,
    runner_veth: binding.runnerVeth,
    comment_prefix: binding.commentPrefix,
    transaction_id: binding.transactionId,
  };
  // biome-ignore format: keep the bounded template rendering helper within the test-file cap
  return heredoc('ACCOUNTING_BASE_NFT').replaceAll(/\$\{?([a-z_]+)\}?/g, (_, key) => { assert.ok(Object.hasOwn(values, key), `unbound template value: ${key}`); return String(values[key]); });
}
const match = (left, right, op = '==') => ({ match: { op, left, right } });
const meta = (key) => ({ meta: { key } });
const ct = (key) => ({ ct: { key } });
const counter = (bytes) => ({ counter: { packets: 1, bytes } });
const expectedRules = () => [
  {
    id: 'classify-measurement',
    chain: policy.classifyChain,
    expr: [
      match(meta('iifname'), binding.runnerVeth),
      match(meta('oifname'), binding.external),
      { mangle: { key: ct('mark'), value: binding.mark } },
    ],
  },
  {
    id: 'forwarded-ingress',
    chain: policy.ingressChain,
    expr: [
      match(meta('iifname'), binding.external),
      match({ fib: { result: 'type', flags: ['daddr'] } }, 'local', '!='),
      counter(200),
    ],
  },
  {
    id: 'measurement-ingress',
    chain: policy.ingressChain,
    expr: [
      match(meta('iifname'), binding.external),
      match(meta('oifname'), binding.runnerVeth),
      match(ct('mark'), binding.mark),
      counter(300),
    ],
  },
  {
    id: 'host-local-ingress',
    chain: policy.hostIngressChain,
    expr: [match(meta('iifname'), binding.external), counter(400)],
  },
  {
    id: 'forwarded-egress',
    chain: policy.egressChain,
    expr: [
      match(meta('oifname'), binding.external),
      match(meta('iif'), 0, '!='),
      counter(500),
    ],
  },
  {
    id: 'measurement-egress',
    chain: policy.egressChain,
    expr: [
      match(meta('oifname'), binding.external),
      match(meta('iif'), 0, '!='),
      match(ct('mark'), binding.mark),
      counter(600),
    ],
  },
  {
    id: 'host-originated-egress',
    chain: policy.hostEgressChain,
    expr: [
      match(meta('oifname'), binding.external),
      match(meta('iif'), 0),
      counter(700),
    ],
  },
];
function fixture(mode = 'complete') {
  const chains = [
    [policy.classifyChain, policy.classifyHook, policy.classifyPriority],
    [policy.ingressChain, policy.ingressHook, policy.counterPriority],
    [policy.hostIngressChain, policy.hostIngressHook, policy.counterPriority],
    [policy.egressChain, policy.egressHook, policy.counterPriority],
    [policy.hostEgressChain, policy.egressHook, policy.counterPriority],
  ];
  return {
    nftables: [
      { metainfo: { json_schema_version: 1 } },
      { table: { family: policy.family, name: policy.table, handle: 1 } },
      ...chains.map(([name, hook, prio], index) => ({
        chain: {
          family: policy.family,
          table: policy.table,
          name,
          type: 'filter',
          hook,
          prio,
          policy: 'accept',
          handle: index + 2,
        },
      })),
      ...expectedRules()
        .filter(
          ({ id }) =>
            mode === 'complete' ||
            !['classify-measurement', 'measurement-ingress'].includes(id)
        )
        .map((expected, index) => ({
          rule: {
            family: policy.family,
            table: policy.table,
            chain: expected.chain,
            handle: index + 10,
            comment: `${binding.commentPrefix}${binding.transactionId}:${expected.id}`,
            expr: expected.expr,
          },
        })),
    ],
  };
}
// biome-ignore format: compact fixture builder keeps the governed test file within its line cap
const accountingConfig = (mode = 'complete') => ({ ...policy, campaignMark: binding.mark, externalInterface: binding.external, runnerInterface: mode === 'complete' ? binding.runnerVeth : null, transactionId: binding.transactionId, commentPrefix: binding.commentPrefix });
function validate(snapshot, mode = 'complete') {
  try {
    const plan = createAccountingPlan(accountingConfig(mode));
    const identity = createAccountingIdentity(plan, snapshot);
    return { status: 0, stdout: JSON.stringify(identity), stderr: '' };
  } catch (error) {
    return { status: 1, stdout: '', stderr: `${error.message}\n` };
  }
}
test('renders only the policy-derived base counters before a veth exists', () => {
  const rules = renderRules();
  assert.match(rules, /hook forward priority -150/);
  assert.match(rules, /iifname "eth0" fib daddr type != local counter/);
  assert.match(rules, /hook input priority 0/);
  assert.match(rules, /oifname "eth0" meta iif != 0 counter/);
  assert.match(rules, /oifname "eth0" meta iif 0 counter/);
  assert.equal((rules.match(/\bcounter\b/g) ?? []).length, 5);
  // biome-ignore format: keep assertion coverage without exceeding the test-file cap
  assert.doesNotMatch(rules, /runner_veth|classify-measurement|measurement-ingress/);
  assert.doesNotMatch(rules, /\b(drop|reject|redirect|dnat|snat|masquerade)\b/);
});
test('uses the shared mark helper and every policy accounting value', () => {
  assert.match(
    source,
    /campaign_mark=\$\(\/usr\/bin\/node "\$POLICY_TOOL" campaign-mark "\$transaction_id"\)/
  );
  assert.doesNotMatch(source, /deriveCampaignMark/);
  for (const key of Object.keys(policy)) {
    assert.match(source, new RegExp(`/networkAccounting/${key}`));
  }
  assert.match(source, /classifier must precede accounting counters/);
  assert.doesNotMatch(source, /systemctl start baci-cwv-measurement\.service/);
  assert.ok(
    source.indexOf('network create') < source.indexOf('ACCOUNTING_BASE_NFT')
  );
});
test('base identity is durable but explicitly ineligible for sampling', async () => {
  const result = await validate(fixture('base'), 'base');
  assert.equal(result.status, 0, result.stderr);
  const identity = JSON.parse(result.stdout);
  assert.equal(identity.readyForSampling, false);
  assert.equal(identity.runnerInterface, null);
  assert.equal(identity.counters.measurementIngress, undefined);
  assert.equal(Object.keys(identity.handles).length, 5);
  assert.match(source, /accounting-base-identity\.json/);
});
test('accepts one complete ruleset and emits bounded counter identity', async () => {
  const result = await validate(fixture());
  assert.equal(result.status, 0, result.stderr);
  const identity = JSON.parse(result.stdout);
  assert.deepEqual(identity.counters, {
    forwardedIngress: 200,
    measurementIngress: 300,
    hostLocalIngress: 400,
    forwardedEgress: 500,
    measurementEgress: 600,
    hostOriginatedEgress: 700,
  });
  assert.equal(Object.keys(identity.handles).length, 7);
  assert.equal(identity.campaignMark, binding.mark);
  assert.equal(identity.readyForSampling, true);
});

test('rejects missing, duplicate, reset-unsafe, and selector-drifted counters', async () => {
  const missing = fixture();
  missing.nftables.pop();
  assert.notEqual((await validate(missing)).status, 0);

  const duplicate = fixture();
  duplicate.nftables.push(structuredClone(duplicate.nftables.at(-1)));
  duplicate.nftables.at(-1).rule.handle = 99;
  assert.notEqual((await validate(duplicate)).status, 0);

  const unsafe = fixture();
  unsafe.nftables.at(-1).rule.expr.at(-1).counter.bytes = -1;
  assert.notEqual((await validate(unsafe)).status, 0);

  const drifted = fixture();
  drifted.nftables.at(-2).rule.expr[0].match.right = 'eth1';
  assert.notEqual((await validate(drifted)).status, 0);
});
test('fails closed when the veth, external interface, mark, or priorities drift', async () => {
  for (const runnerInterface of ['bad/interface', 123]) {
    assert.throws(
      () => createAccountingPlan({ ...accountingConfig(), runnerInterface }),
      /accounting/
    );
  }
  const cases = [
    [
      'veth',
      (value) => (value.nftables.at(-7).rule.expr[0].match.right = 'veth-new'),
    ],
    [
      'external',
      (value) => (value.nftables.at(-1).rule.expr[0].match.right = 'eth1'),
    ],
    ['mark', (value) => (value.nftables.at(-5).rule.expr[2].match.right = 1)],
    ['priority', (value) => (value.nftables[2].chain.prio = 0)],
    [
      'order',
      (value) => {
        [value.nftables[2], value.nftables[3]] = [
          value.nftables[3],
          value.nftables[2],
        ];
        value.nftables.splice(
          -2,
          2,
          value.nftables.at(-1),
          value.nftables.at(-2)
        );
      },
    ],
  ];
  for (const [name, mutate] of cases) {
    const value = fixture();
    mutate(value);
    assert.notEqual((await validate(value)).status, 0, name);
  }
});
