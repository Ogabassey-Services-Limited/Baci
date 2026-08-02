import { readFile } from 'node:fs/promises';
import {
  validateAccountingIdentity,
  validateAccountingPlan,
} from './campaign-accounting-contract.mjs';
import { canonicalJson } from './campaign-network-contract.mjs';
import {
  assertOwnershipReceipt,
  validateOwnedNetwork,
} from './campaign-ownership.mjs';
import { verifyBaseline } from './campaign-restore-baseline.mjs';
import policy from './policy.json' with { type: 'json' };
import { parseRunnerPolicy } from './policy.schema.mjs';

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const fail = (message) => {
  throw new Error(message);
};
const compare = (left, right) => canonicalJson(left) === canonicalJson(right);
const denyCidrs =
  parseRunnerPolicy(policy).dedicatedRuntime.deniedDestinationCidrs.toSorted();

const same = (left, right) => compare(left, right);
const step = (id, args) => ({ id, args });
const command = (line) => line.split(' ');
const ipv4Cidr = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d|[12]\d|3[0-2])$/;

function cidrRange(value) {
  const match = ipv4Cidr.exec(value);
  if (!match) return null;
  const octets = match[1].split('.').map(Number);
  if (octets.some((octet) => octet > 255)) return null;
  const prefix = Number(match[2]);
  const address = octets.reduce((total, octet) => total * 256 + octet, 0);
  const size = 2 ** (32 - prefix);
  const start = Math.floor(address / size) * size;
  return start === address ? [start, start + size - 1] : null;
}

function authorizedDenyCidr(value) {
  const range = cidrRange(value);
  return (
    range &&
    denyCidrs.some((allowed) => {
      const parent = cidrRange(allowed);
      return range[0] >= parent[0] && range[1] <= parent[1];
    })
  );
}

function validateIsolationPlan({
  ownership,
  inputChain,
  forwardChain,
  comment,
  bridge,
  subnet,
  externalInterface,
}) {
  const steps = ownership.isolation.steps;
  const leading = [
    step('input-chain', ['-N', inputChain]),
    step('forward-chain', ['-N', forwardChain]),
    step(
      'input-source',
      command(`-A ${inputChain} -i ${bridge} ! -s ${subnet} -j REJECT`)
    ),
  ];
  const trailing = [
    step(
      'input-default',
      command(`-A ${inputChain} -i ${bridge} -s ${subnet} -j REJECT`)
    ),
    step(
      'forward-source',
      command(`-A ${forwardChain} -i ${bridge} ! -s ${subnet} -j REJECT`)
    ),
    step(
      'forward-reply',
      command(
        `-A ${forwardChain} -i ${externalInterface} -o ${bridge} -d ${subnet} -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT`
      )
    ),
    step(
      'forward-egress',
      command(
        `-A ${forwardChain} -i ${bridge} -s ${subnet} -o ${externalInterface} -j ACCEPT`
      )
    ),
    step(
      'forward-default',
      command(`-A ${forwardChain} -i ${bridge} -j REJECT`)
    ),
    step(
      'input-anchor',
      command(`-I INPUT 1 -m comment --comment ${comment} -j ${inputChain}`)
    ),
    step(
      'forward-anchor',
      command(
        `-I DOCKER-USER 1 -m comment --comment ${comment} -j ${forwardChain}`
      )
    ),
    step(
      'nat-anchor',
      command(
        `-t nat -I POSTROUTING 1 -s ${subnet} -o ${externalInterface} -m comment --comment ${comment} -j MASQUERADE`
      )
    ),
  ];
  let index = 0;
  for (const expected of leading) {
    const actual = steps[index];
    if (!actual) return;
    if (actual.id !== expected.id || !same(actual.args, expected.args))
      fail('ownership receipt required');
    index += 1;
  }
  const appliedDenyCidrs = [];
  let pendingDenyCidr = null;
  while (index < steps.length && steps[index].id.startsWith('deny-')) {
    const actual = steps[index];
    const isInput = actual.id.startsWith('deny-input:');
    const isForward = actual.id.startsWith('deny-forward:');
    const cidr = actual.id.slice(
      isInput ? 'deny-input:'.length : 'deny-forward:'.length
    );
    const expectedArgs = command(
      `-A ${isInput ? inputChain : forwardChain} -i ${bridge} -s ${subnet} -d ${cidr} -j REJECT`
    );
    if (
      (!isInput && !isForward) ||
      !authorizedDenyCidr(cidr) ||
      !same(actual.args, expectedArgs)
    )
      fail('ownership receipt required');
    if (isInput) {
      if (pendingDenyCidr || (appliedDenyCidrs.at(-1) ?? '') >= cidr)
        fail('ownership receipt required');
      if (
        denyCidrs.some(
          (allowed) => allowed < cidr && !appliedDenyCidrs.includes(allowed)
        )
      )
        fail('ownership receipt required');
      pendingDenyCidr = cidr;
    } else {
      if (pendingDenyCidr !== cidr) fail('ownership receipt required');
      appliedDenyCidrs.push(cidr);
      pendingDenyCidr = null;
    }
    index += 1;
  }
  if (index === steps.length) return;
  if (
    pendingDenyCidr ||
    !denyCidrs.every((cidr) => appliedDenyCidrs.includes(cidr))
  )
    fail('ownership receipt required');
  for (const expected of trailing) {
    const actual = steps[index];
    if (!actual) return;
    if (actual.id !== expected.id || !same(actual.args, expected.args))
      fail('ownership receipt required');
    index += 1;
  }
  if (index !== steps.length) fail('ownership receipt required');
}

export function validateOwnership({
  capture,
  ownership,
  transactionId,
  captureSha256,
  network,
  bridge,
  gateway,
  subnet,
  inputChain,
  forwardChain,
  comment,
  accountingFamily,
  accountingTable,
}) {
  assertOwnershipReceipt(ownership, transactionId, captureSha256);
  const prior = capture.priorState.network;
  const expectedPlan = {
    schemaVersion: 1,
    name: network,
    bridge,
    gateway,
    subnet,
    labels: {
      'baci.cwv.capture': captureSha256,
      'baci.cwv.transaction': transactionId,
    },
    baselineSha256: prior.baselineSha256,
    externalInterface: prior.externalInterface,
    inventories: prior.inventories,
  };
  if (!compare(ownership.network.plan, expectedPlan))
    fail('ownership receipt required');
  validateIsolationPlan({
    ownership,
    inputChain,
    forwardChain,
    comment,
    bridge,
    subnet,
    externalInterface: prior.externalInterface.name,
  });
  if (
    ownership.accounting &&
    (ownership.accounting.plan.family !== accountingFamily ||
      ownership.accounting.plan.table !== accountingTable)
  )
    fail('ownership receipt required');
}

export function validateAccounting({ receipt, identity, current }) {
  if (receipt) {
    if (receipt.accounting?.status === 'intent')
      return validateAccountingPlan(receipt.accounting.plan, current);
    if (receipt.accounting?.status === 'applied')
      return validateAccountingIdentity(receipt.accounting.identity, current);
    fail('accounting identity required');
  }
  return validateAccountingIdentity(identity, current);
}

export function validateNetwork({ ownership, current }) {
  return validateOwnedNetwork(ownership, current);
}

async function main([mode, ...args]) {
  if (mode === 'ownership') {
    const [
      captureFile,
      ownershipFile,
      transactionId,
      captureSha256,
      network,
      bridge,
      gateway,
      subnet,
      inputChain,
      forwardChain,
      comment,
      accountingFamily,
      accountingTable,
    ] = args;
    validateOwnership({
      capture: await readJson(captureFile),
      ownership: await readJson(ownershipFile),
      transactionId,
      captureSha256,
      network,
      bridge,
      gateway,
      subnet,
      inputChain,
      forwardChain,
      comment,
      accountingFamily,
      accountingTable,
    });
  } else if (mode === 'accounting')
    validateAccounting({
      receipt: await readJson(args[0]),
      current: await readJson(args[1]),
    });
  else if (mode === 'network')
    validateNetwork({
      ownership: await readJson(args[0]),
      current: await readFile(args[1]),
    });
  else if (mode === 'baseline')
    await verifyBaseline(await readJson(args[0]), args[1]);
  else fail('closed restore validation required');
}

if (import.meta.filename === process.argv[1])
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
