import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

const COUNTERS = [
  ['forwarded-ingress', 'forwardedIngress'],
  ['measurement-ingress', 'measurementIngress'],
  ['host-local-ingress', 'hostLocalIngress'],
  ['forwarded-egress', 'forwardedEgress'],
  ['measurement-egress', 'measurementEgress'],
  ['host-originated-egress', 'hostOriginatedEgress'],
];
const fail = (message) => {
  throw new TypeError(message);
};
const read = (root, file) => fs.readFileSync(`${root}/${file}`, 'utf8');
const json = (root, file) => {
  try {
    return JSON.parse(read(root, file));
  } catch {
    fail(`malformed ${file}`);
  }
};
const match = (left, right, op = '==') => ({ match: { left, op, right } });
const meta = (key) => ({ meta: { key } });
const ct = (key) => ({ ct: { key } });
const counted = { counter: true };
const canonical = (value) =>
  Array.isArray(value)
    ? `[${value.map(canonical).join(',')}]`
    : value && typeof value === 'object'
      ? `{${Object.keys(value)
          .sort()
          .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
          .join(',')}}`
      : JSON.stringify(value);
const digest = (value) =>
  createHash('sha256').update(canonical(value)).digest('hex');

const chainSpec = (input) => [
  [
    input.networkAccounting.classifyChain,
    input.networkAccounting.classifyHook,
    input.networkAccounting.classifyPriority,
  ],
  [
    input.networkAccounting.ingressChain,
    input.networkAccounting.ingressHook,
    input.networkAccounting.counterPriority,
  ],
  [
    input.networkAccounting.hostIngressChain,
    input.networkAccounting.hostIngressHook,
    input.networkAccounting.counterPriority,
  ],
  [
    input.networkAccounting.egressChain,
    input.networkAccounting.egressHook,
    input.networkAccounting.counterPriority,
  ],
  [
    input.networkAccounting.hostEgressChain,
    input.networkAccounting.egressHook,
    input.networkAccounting.counterPriority,
  ],
];
const expectedRules = (input) => {
  const { identity, mode, runtime } = input;
  const rules = [
    [
      'classify-measurement',
      input.networkAccounting.classifyChain,
      [
        match(meta('iifname'), runtime.runnerVeth),
        match(meta('oifname'), runtime.externalInterface),
        { mangle: { key: ct('mark'), value: identity.campaignMark } },
      ],
    ],
    [
      'forwarded-ingress',
      input.networkAccounting.ingressChain,
      [
        match(meta('iifname'), identity.externalInterface),
        match({ fib: { result: 'type', flags: ['daddr'] } }, 'local', '!='),
        counted,
      ],
    ],
    [
      'measurement-ingress',
      input.networkAccounting.ingressChain,
      [
        match(meta('iifname'), identity.externalInterface),
        match(meta('oifname'), runtime.runnerVeth),
        match(ct('mark'), identity.campaignMark),
        counted,
      ],
    ],
    [
      'host-local-ingress',
      input.networkAccounting.hostIngressChain,
      [match(meta('iifname'), identity.externalInterface), counted],
    ],
    [
      'forwarded-egress',
      input.networkAccounting.egressChain,
      [
        match(meta('oifname'), identity.externalInterface),
        match(meta('iif'), 0, '!='),
        counted,
      ],
    ],
    [
      'measurement-egress',
      input.networkAccounting.egressChain,
      [
        match(meta('oifname'), identity.externalInterface),
        match(meta('iif'), 0, '!='),
        match(ct('mark'), identity.campaignMark),
        counted,
      ],
    ],
    [
      'host-originated-egress',
      input.networkAccounting.hostEgressChain,
      [
        match(meta('oifname'), identity.externalInterface),
        match(meta('iif'), 0),
        counted,
      ],
    ],
  ];
  return rules.filter(
    ([id]) =>
      mode === 'live' ||
      ![
        'classify-measurement',
        'measurement-ingress',
        'measurement-egress',
      ].includes(id)
  );
};

export function counters(root, point, input) {
  const { campaignId, family, table, identity, ruleCommentPrefix } = input;
  const entries = json(root, `${point}/nft`).nftables;
  if (!Array.isArray(entries)) fail('malformed nft');
  const tables = entries.flatMap((entry) =>
    entry?.table ? [entry.table] : []
  );
  const chains = entries.flatMap((entry) =>
    entry?.chain ? [entry.chain] : []
  );
  const rules = entries.flatMap((entry) => (entry?.rule ? [entry.rule] : []));
  if (
    tables.length !== 1 ||
    tables[0]?.family !== family ||
    tables[0]?.name !== table ||
    tables[0]?.handle !== identity.tableHandle
  )
    fail('accounting table');
  const expectedChains = chainSpec(input);
  if (chains.length !== expectedChains.length) fail('accounting chains');
  for (const [name, hook, prio] of expectedChains) {
    const found = chains.filter(
      (chain) =>
        chain.family === family &&
        chain.table === table &&
        chain.name === name &&
        chain.type === 'filter' &&
        chain.hook === hook &&
        chain.prio === prio &&
        chain.policy === 'accept' &&
        chain.handle === identity.chainHandles?.[name]
    );
    if (found.length !== 1) fail('accounting chain');
  }
  const prefix = `${ruleCommentPrefix}${campaignId}:`;
  const values = {};
  const expected = expectedRules(input);
  if (rules.length !== expected.length) fail('accounting rules');
  for (const [id, chain, expression] of expected) {
    const found = rules.filter(
      (rule) =>
        rule.family === family &&
        rule.table === table &&
        rule.chain === chain &&
        rule.comment === `${prefix}${id}` &&
        rule.handle === identity.handles?.[id]
    );
    if (found.length !== 1) fail(`counter ${id}`);
    const normalized = found[0].expr.map((item) =>
      item.counter ? counted : item
    );
    if (!isDeepStrictEqual(normalized, expression)) fail(`selector ${id}`);
    const counter = found[0].expr.find((item) => item.counter)?.counter;
    if (
      counter &&
      (!Number.isSafeInteger(counter.bytes) ||
        counter.bytes < 0 ||
        !Number.isSafeInteger(counter.packets) ||
        counter.packets < 0)
    )
      fail(`counter ${id}`);
    if (counter)
      values[COUNTERS.find(([name]) => name === id)[1]] = counter.bytes;
  }
  for (const [_name, key] of COUNTERS)
    if (!Object.hasOwn(values, key)) values[key] = 0;
  return values;
}

export function evidenceDigests(root, point) {
  return Object.fromEntries(
    [
      'nft',
      'runner',
      'interfaces',
      'conntrack',
      'cgroup',
      'cgroup.events',
      'processes',
      'applications',
    ].map((file) => [
      file.replace('.', '_'),
      createHash('sha256')
        .update(fs.readFileSync(`${root}/${point}/${file}`))
        .digest('hex'),
    ])
  );
}

export function accountingDigests(root, point) {
  const entries = json(root, `${point}/nft`).nftables;
  if (!Array.isArray(entries)) fail('malformed nft');
  return {
    chains: digest(
      entries.flatMap((entry) => (entry?.chain ? [entry.chain] : []))
    ),
    rules: digest(
      entries.flatMap((entry) => (entry?.rule ? [entry.rule] : []))
    ),
  };
}
