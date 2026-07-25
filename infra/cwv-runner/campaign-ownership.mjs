import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { open, readFile, rename } from 'node:fs/promises';
import path from 'node:path';

import { canonicalJson } from './campaign-network-contract.mjs';

const SHA = /^[a-f0-9]{64}$/;
const DENY_STEP_ID =
  /^deny-(?:input|forward):(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\/(?:[0-9]|[12]\d|3[0-2])$/;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const fail = (message = 'ownership receipt required') => {
  throw new Error(message);
};
const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const exactKeys = (value, keys) =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
const validStepId = (value) =>
  typeof value === 'string' &&
  (DENY_STEP_ID.test(value) ||
    (!value.startsWith('deny-input:') &&
      !value.startsWith('deny-forward:') &&
      /^[a-z0-9][a-z0-9:.-]{0,127}$/.test(value)));

async function atomicWrite(file, value) {
  const temporary = `${file}.tmp-${process.pid}`;
  const handle = await open(temporary, 'wx', 0o600);
  try {
    await handle.writeFile(`${canonicalJson(value)}\n`);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temporary, file);
  const directory = await open(path.dirname(file), 'r');
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}

export function assertOwnershipReceipt(receipt, transactionId, captureSha256) {
  if (
    !exactKeys(receipt, [
      'accounting',
      'captureSha256',
      'isolation',
      'network',
      'schemaVersion',
      'transactionId',
    ]) ||
    receipt.schemaVersion !== 2 ||
    receipt.transactionId !== transactionId ||
    receipt.captureSha256 !== captureSha256 ||
    !SHA.test(captureSha256) ||
    !['intent', 'applied'].includes(receipt.network?.status) ||
    !exactKeys(receipt.network, ['identity', 'plan', 'status']) ||
    !receipt.network.plan ||
    (receipt.network.status === 'applied' && !receipt.network.identity) ||
    !Array.isArray(receipt.isolation?.steps)
  )
    fail();
  let pending = false;
  const ids = new Set();
  for (const step of receipt.isolation.steps) {
    if (
      !exactKeys(step, ['args', 'id', 'readbackSha256', 'status']) ||
      !validStepId(step.id) ||
      ids.has(step.id) ||
      !Array.isArray(step.args) ||
      !step.args.every(
        (value) => typeof value === 'string' && value.length > 0
      ) ||
      !['intent', 'applied'].includes(step.status) ||
      (step.status === 'applied'
        ? !SHA.test(step.readbackSha256)
        : step.readbackSha256 !== null) ||
      pending
    )
      fail();
    ids.add(step.id);
    pending = step.status === 'intent';
  }
  if (
    receipt.accounting !== null &&
    (!exactKeys(receipt.accounting, ['identity', 'plan', 'status']) ||
      !['intent', 'applied'].includes(receipt.accounting?.status) ||
      !receipt.accounting.plan ||
      (receipt.accounting.status === 'intent'
        ? receipt.accounting.identity !== null
        : !receipt.accounting.identity))
  )
    fail();
  return receipt;
}

function networkIdentity(plan, bytes) {
  const parsed = JSON.parse(bytes);
  const row = parsed?.[0];
  if (
    parsed.length !== 1 ||
    row.Name !== plan.name ||
    row.IPAM?.Config?.[0]?.Gateway !== plan.gateway ||
    row.IPAM?.Config?.[0]?.Subnet !== plan.subnet ||
    row.Options?.['com.docker.network.bridge.name'] !== plan.bridge ||
    canonicalJson(row.Labels ?? {}) !== canonicalJson(plan.labels) ||
    !SHA.test(row.Id) ||
    typeof row.Created !== 'string'
  )
    fail('network identity mismatch');
  return {
    id: row.Id,
    name: row.Name,
    created: row.Created,
    gateway: plan.gateway,
    subnet: plan.subnet,
    bridge: plan.bridge,
    labels: plan.labels,
    inspectSha256: sha256(bytes),
  };
}

export function validateOwnedNetwork(receipt, bytes) {
  const actual = networkIdentity(receipt.network.plan, bytes);
  if (
    receipt.network.status === 'applied' &&
    canonicalJson(actual) !== canonicalJson(receipt.network.identity)
  )
    fail('network identity mismatch');
  return actual;
}

const run = (file, args) => spawnSync(file, args, { encoding: 'utf8' });

export function rollbackIsolation(receipt, execute = run) {
  for (const step of [...receipt.isolation.steps].reverse()) {
    const args = [...step.args];
    const table = args[0] === '-t' ? args.splice(0, 2) : [];
    const operation = args.shift();
    const chain = args.shift();
    if (operation === '-N') {
      const current = execute('/usr/sbin/iptables', [...table, '-S', chain]);
      if (current.status === 1) continue;
      if (current.status !== 0 || current.stdout !== `-N ${chain}\n`)
        fail('isolation identity mismatch');
      if (execute('/usr/sbin/iptables', [...table, '-X', chain]).status !== 0)
        fail('isolation rollback failed');
      continue;
    }
    if (!['-A', '-I'].includes(operation)) fail('isolation identity mismatch');
    if (operation === '-I' && /^\d+$/.test(args[0])) args.shift();
    const check = execute('/usr/sbin/iptables', [
      ...table,
      '-C',
      chain,
      ...args,
    ]);
    if (check.status === 1) continue;
    if (check.status !== 0) fail('isolation identity mismatch');
    if (
      execute('/usr/sbin/iptables', [...table, '-D', chain, ...args]).status !==
      0
    )
      fail('isolation rollback failed');
  }
}

async function update(file, command, args) {
  if (command === 'network-intent') {
    const [transactionId, captureSha256, planFile] = args;
    const receipt = {
      schemaVersion: 2,
      transactionId,
      captureSha256,
      network: {
        status: 'intent',
        plan: await readJson(planFile),
        identity: null,
      },
      isolation: { steps: [] },
      accounting: null,
    };
    assertOwnershipReceipt(receipt, transactionId, captureSha256);
    await atomicWrite(file, receipt);
    return;
  }
  const receipt = await readJson(file);
  assertOwnershipReceipt(receipt, receipt.transactionId, receipt.captureSha256);
  if (command === 'network-applied') {
    if (receipt.network.status !== 'intent') fail();
    const bytes = await readFile(args[0]);
    receipt.network = {
      ...receipt.network,
      status: 'applied',
      identity: networkIdentity(receipt.network.plan, bytes),
    };
  } else if (command === 'isolation-intent') {
    if (receipt.network.status !== 'applied') fail();
    if (receipt.isolation.steps.some((step) => step.status === 'intent'))
      fail();
    receipt.isolation.steps.push({
      id: args[0],
      args: args.slice(1),
      status: 'intent',
      readbackSha256: null,
    });
  } else if (command === 'isolation-applied') {
    const step = receipt.isolation.steps.at(-1);
    if (step?.id !== args[0] || step.status !== 'intent') fail();
    step.status = 'applied';
    step.readbackSha256 = sha256(await readFile(args[1]));
  } else if (command === 'accounting-intent') {
    if (receipt.isolation.steps.some((step) => step.status !== 'applied'))
      fail();
    receipt.accounting = {
      status: 'intent',
      plan: await readJson(args[0]),
      identity: null,
    };
  } else if (command === 'accounting-applied') {
    if (receipt.accounting?.status !== 'intent') fail();
    receipt.accounting = {
      ...receipt.accounting,
      status: 'applied',
      identity: await readJson(args[0]),
    };
  } else fail('ownership command required');
  assertOwnershipReceipt(receipt, receipt.transactionId, receipt.captureSha256);
  await atomicWrite(file, receipt);
}

async function main([command, file, ...args]) {
  if (command === 'rollback-isolation') {
    const receipt = await readJson(file);
    assertOwnershipReceipt(
      receipt,
      receipt.transactionId,
      receipt.captureSha256
    );
    rollbackIsolation(receipt);
    return;
  }
  await update(file, command, args);
}

if (import.meta.filename === process.argv[1])
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
