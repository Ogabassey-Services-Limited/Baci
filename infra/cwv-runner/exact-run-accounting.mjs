// biome-ignore-all format: compact accounting verifier stays below the repository file limit
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const BASE_COUNTERS = Object.freeze([['forwarded-ingress', 'forwardedIngress'], ['host-local-ingress', 'hostLocalIngress'], ['forwarded-egress', 'forwardedEgress'], ['measurement-egress', 'measurementEgress'], ['host-originated-egress', 'hostOriginatedEgress']]);
const COUNTERS = Object.freeze([BASE_COUNTERS[0], ['measurement-ingress', 'measurementIngress'], ...BASE_COUNTERS.slice(1)]);
const CLASSIFIER = 'classify-measurement';
const ROLE_NAMES = Object.freeze([...COUNTERS.map(([name]) => name), CLASSIFIER]);
const BASE_ROLE_NAMES = Object.freeze(BASE_COUNTERS.map(([name]) => name));

function fail(message) { throw new Error(message); }
function exactKeys(value, expected, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(`${name} is invalid`);
  const actual = Object.keys(value).sort(); const closed = [...expected].sort();
  if (actual.length !== closed.length || actual.some((key, index) => key !== closed[index])) fail(`${name} keys are not exact`);
}
function sameValue(actual, expected) {
  if (Object.is(actual, expected)) return true;
  if (actual === null || expected === null || typeof actual !== 'object' || typeof expected !== 'object') return false;
  if (Array.isArray(actual) || Array.isArray(expected)) return Array.isArray(actual) && Array.isArray(expected) && actual.length === expected.length && actual.every((item, index) => sameValue(item, expected[index]));
  const actualKeys = Object.keys(actual).sort(); const expectedKeys = Object.keys(expected).sort();
  return actualKeys.length === expectedKeys.length && actualKeys.every((key, index) => key === expectedKeys[index] && sameValue(actual[key], expected[key]));
}
const match = (left, right, op = '==') => ({ match: { op, left, right } });
const meta = (key) => ({ meta: { key } });
const ct = (key) => ({ ct: { key } });
const iif = (name) => match(meta('iifname'), name);
const oif = (name) => match(meta('oifname'), name);
const mark = (value) => match(ct('mark'), value);
const hostOrigin = (op) => match(meta('iif'), 0, op);
const nonLocalDestination = () => match({ fib: { flags: ['daddr'], result: 'type' } }, 'local', '!=');
function counterExpression(role, runtime) {
  return {
    'forwarded-ingress': [iif(runtime.externalInterface), nonLocalDestination()],
    'measurement-ingress': [iif(runtime.externalInterface), oif(runtime.runnerVeth), mark(runtime.campaignMark)],
    'host-local-ingress': [iif(runtime.externalInterface)],
    'forwarded-egress': [oif(runtime.externalInterface), hostOrigin('!=')],
    'measurement-egress': [oif(runtime.externalInterface), hostOrigin('!='), mark(runtime.campaignMark)],
    'host-originated-egress': [oif(runtime.externalInterface), hostOrigin('==')],
  }[role];
}
function counterBytes(role, expression, runtime) {
  const expected = counterExpression(role, runtime);
  if (!Array.isArray(expression) || expression.length !== expected.length + 1 || !expected.every((item, index) => sameValue(expression[index], item))) fail('accounting rule semantic drift');
  const value = expression.at(-1); exactKeys(value, ['counter'], 'accounting counter expression'); exactKeys(value.counter, ['bytes', 'packets'], 'accounting counter');
  if (!Number.isSafeInteger(value.counter.bytes) || value.counter.bytes < 0 || !Number.isSafeInteger(value.counter.packets) || value.counter.packets < 0) fail(`accounting counter drift: ${role}`);
  return value.counter.bytes;
}
const identityDigest = (identity) => createHash('sha256').update(JSON.stringify(identity)).digest('hex');
function ruleFor(rules, prefix, name, family, table, handle) {
  const matches = rules.filter((rule) => rule.comment === `${prefix}${name}` && rule.family === family && rule.table === table && (handle === undefined || rule.handle === handle));
  if (matches.length !== 1 || !Number.isSafeInteger(matches[0].handle) || matches[0].handle < 1) fail(`accounting rule drift: ${name}`);
  exactKeys(matches[0], ['chain', 'comment', 'expr', 'family', 'handle', 'table'], 'accounting rule');
  return matches[0];
}
function exactChain(chain, expected) { return sameValue(chain, expected); }

export function buildCompleteAccountingIdentity({ base, campaignId, nft, runtime }) {
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(campaignId) || !/^[A-Za-z0-9_.-]{1,15}$/.test(runtime?.runnerVeth)) fail('runtime identity is invalid');
  exactKeys(base, ['campaignMark', 'chainHandles', 'counters', 'externalInterface', 'family', 'handles', 'identitySha256', 'readyForSampling', 'runnerInterface', 'schemaVersion', 'table', 'tableHandle'], 'base identity');
  exactKeys(base.handles, BASE_ROLE_NAMES, 'base rule handles');
  if (Object.keys(base.chainHandles).length !== 5 || Object.values(base.chainHandles).some((handle) => !Number.isSafeInteger(handle) || handle < 1)) fail('base chain handles are invalid');
  const baseProjection = { schemaVersion: base.schemaVersion, family: base.family, table: base.table, tableHandle: base.tableHandle, chainHandles: base.chainHandles, campaignMark: base.campaignMark, externalInterface: base.externalInterface, runnerInterface: base.runnerInterface, readyForSampling: base.readyForSampling, handles: base.handles };
  if (base.schemaVersion !== 1 || base.readyForSampling !== false || base.runnerInterface !== null || base.externalInterface !== runtime.externalInterface || base.campaignMark !== runtime.campaignMark || base.identitySha256 !== identityDigest(baseProjection) || !Number.isSafeInteger(base.tableHandle) || base.tableHandle < 1 || Object.values(base.handles).some((handle) => !Number.isSafeInteger(handle) || handle < 1)) fail('base accounting identity is invalid');
  const entries = nft?.nftables;
  if (!Array.isArray(entries) || entries.some((entry) => entry === null || typeof entry !== 'object' || Array.isArray(entry) || Object.keys(entry).length !== 1 || !['metainfo', 'table', 'chain', 'rule'].includes(Object.keys(entry)[0]))) fail('nft inventory is invalid');
  const tables = entries.flatMap((entry) => entry.table ? [entry.table] : []); const chains = entries.flatMap((entry) => entry.chain ? [entry.chain] : []); const rules = entries.flatMap((entry) => entry.rule ? [entry.rule] : []);
  if (tables.length !== 1 || !sameValue(tables[0], { family: base.family, handle: base.tableHandle, name: base.table }) || chains.length !== 5 || rules.length !== ROLE_NAMES.length) fail('accounting inventory drift');
  const chainByName = new Map();
  for (const chain of chains) {
    exactKeys(chain, ['family', 'handle', 'hook', 'name', 'policy', 'prio', 'table', 'type'], 'accounting chain');
    if (chain.family !== base.family || chain.table !== base.table || chain.type !== 'filter' || chain.policy !== 'accept' || !Number.isSafeInteger(chain.prio) || !Object.hasOwn(base.chainHandles, chain.name) || base.chainHandles[chain.name] !== chain.handle || chainByName.has(chain.name)) fail('accounting chain drift');
    chainByName.set(chain.name, chain);
  }
  const prefix = `baci-cwv:${campaignId}:`;
  if (rules.some((rule) => typeof rule.comment !== 'string') || new Set(rules.map((rule) => rule.comment)).size !== ROLE_NAMES.length || !ROLE_NAMES.every((name) => rules.some((rule) => rule.comment === `${prefix}${name}`))) fail('accounting rule inventory drift');
  const baseRules = Object.fromEntries(BASE_COUNTERS.map(([name]) => [name, ruleFor(rules, prefix, name, base.family, base.table, base.handles[name])]));
  const ingressChain = baseRules['forwarded-ingress'].chain; const hostIngressChain = baseRules['host-local-ingress'].chain; const egressChain = baseRules['forwarded-egress'].chain; const hostEgressChain = baseRules['host-originated-egress'].chain;
  if (baseRules['measurement-egress'].chain !== egressChain || new Set([ingressChain, hostIngressChain, egressChain, hostEgressChain]).size !== 4) fail('accounting chain role drift');
  const classifierChains = [...chainByName.keys()].filter((name) => ![ingressChain, hostIngressChain, egressChain, hostEgressChain].includes(name));
  if (classifierChains.length !== 1 || !exactChain(chainByName.get(ingressChain), { family: base.family, handle: base.chainHandles[ingressChain], hook: 'forward', name: ingressChain, policy: 'accept', prio: 0, table: base.table, type: 'filter' }) || !exactChain(chainByName.get(hostIngressChain), { family: base.family, handle: base.chainHandles[hostIngressChain], hook: 'input', name: hostIngressChain, policy: 'accept', prio: 0, table: base.table, type: 'filter' }) || !exactChain(chainByName.get(egressChain), { family: base.family, handle: base.chainHandles[egressChain], hook: 'postrouting', name: egressChain, policy: 'accept', prio: 0, table: base.table, type: 'filter' }) || !exactChain(chainByName.get(hostEgressChain), { family: base.family, handle: base.chainHandles[hostEgressChain], hook: 'postrouting', name: hostEgressChain, policy: 'accept', prio: 0, table: base.table, type: 'filter' }) || !exactChain(chainByName.get(classifierChains[0]), { family: base.family, handle: base.chainHandles[classifierChains[0]], hook: 'forward', name: classifierChains[0], policy: 'accept', prio: -150, table: base.table, type: 'filter' })) fail('accounting chain semantic drift');
  const measurementIngress = ruleFor(rules, prefix, 'measurement-ingress', base.family, base.table); const classifier = ruleFor(rules, prefix, CLASSIFIER, base.family, base.table);
  if (measurementIngress.chain !== ingressChain || classifier.chain !== classifierChains[0] || !sameValue(measurementIngress.expr, [...counterExpression('measurement-ingress', runtime), { counter: measurementIngress.expr?.at(-1)?.counter }]) || !sameValue(classifier.expr, [iif(runtime.runnerVeth), oif(runtime.externalInterface), { mangle: { key: ct('mark'), value: runtime.campaignMark } }])) fail('accounting rule semantic drift');
  const counters = {}; const handles = {};
  for (const [name, key] of COUNTERS) { const rule = name === 'measurement-ingress' ? measurementIngress : baseRules[name]; counters[key] = counterBytes(name, rule.expr, runtime); handles[name] = rule.handle; }
  handles[CLASSIFIER] = classifier.handle;
  if (new Set([tables[0].handle, ...Object.values(base.chainHandles), ...Object.values(handles)]).size !== 13) fail('accounting handles are not unique');
  const identity = { schemaVersion: 1, family: base.family, table: base.table, tableHandle: base.tableHandle, chainHandles: base.chainHandles, campaignMark: base.campaignMark, externalInterface: base.externalInterface, runnerInterface: runtime.runnerVeth, readyForSampling: true, handles };
  return { ...identity, identitySha256: identityDigest(identity), counters };
}

if (import.meta.filename === process.argv[1]) {
  try { if (process.argv.length !== 6) fail('closed accounting invocation required'); const [basePath, runtimePath, nftPath, campaignId] = process.argv.slice(2); process.stdout.write(`${JSON.stringify(buildCompleteAccountingIdentity({ base: JSON.parse(readFileSync(basePath, 'utf8')), campaignId, nft: JSON.parse(readFileSync(nftPath, 'utf8')), runtime: JSON.parse(readFileSync(runtimePath, 'utf8')) }))}\n`); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 65; }
}
