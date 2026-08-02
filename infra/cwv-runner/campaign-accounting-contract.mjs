import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { canonicalJson } from './campaign-network-contract.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const fail = () => {
  throw new Error('accounting generation mismatch');
};
const compare = (left, right) => canonicalJson(left) === canonicalJson(right);
const match = (left, right, op = '==') => ({ match: { op, left, right } });
const meta = (key) => ({ meta: { key } });
const ct = (key) => ({ ct: { key } });
const counter = { counter: true };

function normalizeExpr(value) {
  if (Array.isArray(value)) return value.map(normalizeExpr);
  if (!value || typeof value !== 'object') return value;
  if ('counter' in value) {
    const { packets, bytes } = value.counter ?? {};
    if (
      !Number.isSafeInteger(packets) ||
      packets < 0 ||
      !Number.isSafeInteger(bytes) ||
      bytes < 0
    )
      fail();
    return counter;
  }
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, normalizeExpr(value[key])])
  );
}

export function createAccountingPlan(config) {
  const priority = Number(config.counterPriority);
  const classifyPriority = Number(config.classifyPriority);
  const mark = Number(config.campaignMark);
  if (
    !Number.isSafeInteger(mark) ||
    mark < 0 ||
    mark > 0xffffffff ||
    !Number.isSafeInteger(priority) ||
    !Number.isSafeInteger(classifyPriority) ||
    classifyPriority >= priority ||
    !/^[A-Za-z0-9_.-]{1,15}$/.test(config.externalInterface) ||
    (config.runnerInterface != null &&
      (typeof config.runnerInterface !== 'string' ||
        !/^[A-Za-z0-9_.-]{1,15}$/.test(config.runnerInterface)))
  )
    fail();
  const comment = (name) =>
    `${config.commentPrefix}${config.transactionId}:${name}`;
  const chains = [
    [config.classifyChain, config.classifyHook, classifyPriority],
    [config.ingressChain, config.ingressHook, priority],
    [config.hostIngressChain, config.hostIngressHook, priority],
    [config.egressChain, config.egressHook, priority],
    [config.hostEgressChain, config.egressHook, priority],
  ].map(([name, hook, prio]) => ({
    name,
    type: 'filter',
    hook,
    prio,
    policy: 'accept',
  }));
  const rules = [
    ...(config.runnerInterface
      ? [
          {
            chain: config.classifyChain,
            comment: comment('classify-measurement'),
            expr: [
              match(meta('iifname'), config.runnerInterface),
              match(meta('oifname'), config.externalInterface),
              { mangle: { key: ct('mark'), value: mark } },
            ],
          },
        ]
      : []),
    {
      chain: config.ingressChain,
      comment: comment('forwarded-ingress'),
      expr: [
        match(meta('iifname'), config.externalInterface),
        match({ fib: { result: 'type', flags: ['daddr'] } }, 'local', '!='),
        counter,
      ],
    },
    ...(config.runnerInterface
      ? [
          {
            chain: config.ingressChain,
            comment: comment('measurement-ingress'),
            expr: [
              match(meta('iifname'), config.externalInterface),
              match(meta('oifname'), config.runnerInterface),
              match(ct('mark'), mark),
              counter,
            ],
          },
        ]
      : []),
    {
      chain: config.hostIngressChain,
      comment: comment('host-local-ingress'),
      expr: [match(meta('iifname'), config.externalInterface), counter],
    },
    {
      chain: config.egressChain,
      comment: comment('forwarded-egress'),
      expr: [
        match(meta('oifname'), config.externalInterface),
        match(meta('iif'), 0, '!='),
        counter,
      ],
    },
    {
      chain: config.egressChain,
      comment: comment('measurement-egress'),
      expr: [
        match(meta('oifname'), config.externalInterface),
        match(meta('iif'), 0, '!='),
        match(ct('mark'), mark),
        counter,
      ],
    },
    {
      chain: config.hostEgressChain,
      comment: comment('host-originated-egress'),
      expr: [
        match(meta('oifname'), config.externalInterface),
        match(meta('iif'), 0),
        counter,
      ],
    },
  ];
  return {
    schemaVersion: 1,
    family: config.family,
    table: config.table,
    campaignMark: mark,
    externalInterface: config.externalInterface,
    runnerInterface: config.runnerInterface ?? null,
    readyForSampling: Boolean(config.runnerInterface),
    chains,
    rules,
  };
}

export function normalizeAccountingReadback(current) {
  const entries = current?.nftables;
  if (!Array.isArray(entries)) fail();
  for (const entry of entries) {
    const keys = Object.keys(entry);
    if (
      keys.length !== 1 ||
      !['metainfo', 'table', 'chain', 'rule'].includes(keys[0])
    )
      fail();
  }
  const tables = entries.flatMap((entry) => (entry.table ? [entry.table] : []));
  const chains = entries.flatMap((entry) => (entry.chain ? [entry.chain] : []));
  const rules = entries.flatMap((entry) => (entry.rule ? [entry.rule] : []));
  if (tables.length !== 1) fail();
  const normalized = {
    table: tables[0],
    chains,
    rules: rules.map((rule) => ({ ...rule, expr: normalizeExpr(rule.expr) })),
  };
  const handles = [
    normalized.table.handle,
    ...normalized.chains.map(({ handle }) => handle),
    ...normalized.rules.map(({ handle }) => handle),
  ];
  if (
    handles.some((handle) => !Number.isSafeInteger(handle) || handle <= 0) ||
    new Set(handles).size !== handles.length
  )
    fail();
  return normalized;
}

export function validateAccountingPlan(plan, current) {
  const actual = normalizeAccountingReadback(current);
  if (
    plan?.schemaVersion !== 1 ||
    actual.table.family !== plan.family ||
    actual.table.name !== plan.table ||
    actual.chains.length !== plan.chains.length ||
    actual.rules.length !== plan.rules.length
  )
    fail();
  const chains = actual.chains.map(({ name, type, hook, prio, policy }) => ({
    name,
    type,
    hook,
    prio,
    policy,
  }));
  const rules = actual.rules.map(({ chain, comment, expr }) => ({
    chain,
    comment,
    expr,
  }));
  if (!compare(chains, plan.chains) || !compare(rules, plan.rules)) fail();
  return actual;
}

export function createAccountingIdentity(plan, current) {
  const normalized = validateAccountingPlan(plan, current);
  const prefix = plan.rules[0]?.comment?.split(':').slice(0, -1).join(':');
  const handles = {};
  const counters = {};
  const counterNames = {
    'forwarded-ingress': 'forwardedIngress',
    'measurement-ingress': 'measurementIngress',
    'host-local-ingress': 'hostLocalIngress',
    'forwarded-egress': 'forwardedEgress',
    'measurement-egress': 'measurementEgress',
    'host-originated-egress': 'hostOriginatedEgress',
  };
  for (const rule of current.nftables.flatMap((entry) =>
    entry.rule ? [entry.rule] : []
  )) {
    const id = rule.comment?.slice(`${prefix}:`.length);
    if (
      !id ||
      !plan.rules.some((candidate) => candidate.comment === rule.comment)
    )
      fail();
    handles[id] = rule.handle;
    const bytes = rule.expr.find((item) => item.counter)?.counter.bytes;
    if (bytes !== undefined) counters[counterNames[id]] = bytes;
  }
  const stable = {
    schemaVersion: 1,
    family: plan.family,
    table: plan.table,
    tableHandle: normalized.table.handle,
    chainHandles: Object.fromEntries(
      normalized.chains.map(({ name, handle }) => [name, handle])
    ),
    campaignMark: plan.campaignMark,
    externalInterface: plan.externalInterface,
    runnerInterface: plan.runnerInterface,
    readyForSampling: plan.readyForSampling,
    handles,
    exact: normalized,
  };
  return {
    ...stable,
    identitySha256: sha256(canonicalJson(stable)),
    counters,
  };
}

export function validateAccountingIdentity(identity, current) {
  const normalized = normalizeAccountingReadback(current);
  const { identitySha256, counters: _counters, ...stable } = identity ?? {};
  if (
    stable.schemaVersion !== 1 ||
    identitySha256 !== sha256(canonicalJson(stable)) ||
    !compare(stable.exact?.table, normalized.table) ||
    !compare(stable.exact?.chains, normalized.chains) ||
    !compare(stable.exact?.rules, normalized.rules)
  )
    fail();
  return normalized;
}

async function main([command, ...args]) {
  if (command === 'plan' && args.length === 1) {
    const config = JSON.parse(await readFile(args[0], 'utf8'));
    process.stdout.write(`${canonicalJson(createAccountingPlan(config))}\n`);
    return;
  }
  if (command !== 'identity' || args.length !== 2)
    throw new Error('accounting contract command required');
  const plan = JSON.parse(await readFile(args[0], 'utf8'));
  const current = JSON.parse(await readFile(args[1], 'utf8'));
  process.stdout.write(
    `${canonicalJson(createAccountingIdentity(plan, current))}\n`
  );
}

if (import.meta.filename === process.argv[1])
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
