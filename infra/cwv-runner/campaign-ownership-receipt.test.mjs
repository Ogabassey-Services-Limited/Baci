import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import { assertOwnershipReceipt } from './campaign-ownership.mjs';

const exec = promisify(execFile);
const tool = new URL('./campaign-ownership.mjs', import.meta.url).pathname;
const sha = (value) => value.repeat(64);

test('ownership receipt survives every intent and applied crash boundary', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cwv-ownership-'));
  const receiptFile = path.join(directory, 'ownership.json');
  const planFile = path.join(directory, 'network-plan.json');
  const inspectFile = path.join(directory, 'network-inspect.json');
  const readbackFile = path.join(directory, 'iptables-save');
  const accountingPlan = path.join(directory, 'accounting-plan.json');
  const accountingIdentity = path.join(directory, 'accounting-identity.json');
  const capture = sha('b');
  const plan = {
    name: 'baci-cwv-net',
    bridge: 'baci-cwv0',
    gateway: '172.31.255.1',
    subnet: '172.31.255.0/28',
    labels: {
      'baci.cwv.capture': capture,
      'baci.cwv.transaction': 'tx',
    },
  };
  await Promise.all([
    writeFile(planFile, JSON.stringify(plan)),
    writeFile(
      inspectFile,
      JSON.stringify([
        {
          Id: sha('a'),
          Name: plan.name,
          Created: '2026-07-22T00:00:00Z',
          Labels: plan.labels,
          IPAM: { Config: [{ Gateway: plan.gateway, Subnet: plan.subnet }] },
          Options: { 'com.docker.network.bridge.name': plan.bridge },
        },
      ])
    ),
    writeFile(readbackFile, '*filter\nCOMMIT\n'),
    writeFile(accountingPlan, '{"schemaVersion":1}'),
    writeFile(accountingIdentity, '{"schemaVersion":2}'),
  ]);
  const run = (...args) => exec(process.execPath, [tool, ...args]);
  const readReceipt = async () =>
    JSON.parse(await readFile(receiptFile, 'utf8'));

  await run('network-intent', receiptFile, 'tx', capture, planFile);
  let receipt = await readReceipt();
  assert.equal(receipt.network.status, 'intent');
  assertOwnershipReceipt(receipt, 'tx', capture);
  assert.equal((await stat(receiptFile)).mode & 0o777, 0o600);

  await run('network-applied', receiptFile, inspectFile);
  receipt = await readReceipt();
  assert.equal(receipt.network.status, 'applied');

  await run('isolation-intent', receiptFile, 'chain', '-N', 'BACI_CWV_INPUT');
  receipt = await readReceipt();
  assert.equal(receipt.isolation.steps.at(-1).status, 'intent');
  await run('isolation-applied', receiptFile, 'chain', readbackFile);
  receipt = await readReceipt();
  assert.equal(receipt.isolation.steps.at(-1).status, 'applied');

  await run('accounting-intent', receiptFile, accountingPlan);
  receipt = await readReceipt();
  assert.equal(receipt.accounting.status, 'intent');
  await run('accounting-applied', receiptFile, accountingIdentity);
  receipt = await readReceipt();
  assert.equal(receipt.accounting.status, 'applied');
  assertOwnershipReceipt(receipt, 'tx', capture);
});
