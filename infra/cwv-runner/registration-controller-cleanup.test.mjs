import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanupRegistration } from './registration-controller-cleanup.mjs';

const containerId = 'a'.repeat(64);
const removalReceipt = {
  containerId,
  removed: true,
  schemaVersion: 1,
};
const absenceReceipt = {
  bridgeAbsent: true,
  captureRestored: true,
  cgroupAbsent: true,
  containerId,
  containerdInactive: true,
  containers: [],
  dockerInactive: true,
  dockerSocketAbsent: true,
  firewallAbsent: true,
  networkAbsent: true,
  processAbsent: true,
  releaseArtifacts: [],
  schemaVersion: 2,
  stagingArtifacts: [],
  tokenArtifacts: [],
};
const cleanupReceipt = (operation) => {
  if (['remove-isolation', 'remove-network'].includes(operation))
    return { schemaVersion: 1, status: 'removed' };
  if (operation === 'stop-daemons')
    return { containerd: 'stopped', docker: 'stopped', schemaVersion: 1 };
  if (operation === 'restore-capture')
    return { capture: 'restored', schemaVersion: 1 };
  return undefined;
};

test('retains safety when removal or zero-inventory proof is not exact', async () => {
  for (const [removal, absence, provesAbsence] of [
    [{ removed: true }, absenceReceipt, false],
    [removalReceipt, { ...absenceReceipt, containers: [containerId] }, true],
  ]) {
    const calls = [];
    const failed = await cleanupRegistration(
      (operation) => {
        calls.push(operation);
        if (operation === 'remove-registration-container') return removal;
        if (operation === 'prove-registration-cleanup') return absence;
        return cleanupReceipt(operation);
      },
      false,
      { containerId, started: true }
    );
    assert.equal(failed, true);
    assert.equal(calls.includes('prove-registration-cleanup'), provesAbsence);
    assert.equal(calls.includes('disarm-watchdog'), false);
    assert.equal(calls.includes('release-lock'), false);
  }
});

test('does not disarm for missing firewall, bridge, runtime, process, or capture restoration proof', async () => {
  for (const field of [
    'bridgeAbsent',
    'captureRestored',
    'cgroupAbsent',
    'containerdInactive',
    'dockerInactive',
    'dockerSocketAbsent',
    'firewallAbsent',
    'networkAbsent',
    'processAbsent',
  ]) {
    const calls = [];
    const failed = await cleanupRegistration(
      (operation) => {
        calls.push(operation);
        if (operation === 'remove-registration-container')
          return removalReceipt;
        if (operation === 'prove-registration-cleanup')
          return { ...absenceReceipt, [field]: false };
        return cleanupReceipt(operation);
      },
      false,
      { containerId, started: true }
    );
    assert.equal(failed, true, field);
    assert.equal(calls.includes('prove-registration-cleanup'), true, field);
    assert.equal(calls.includes('disarm-watchdog'), false, field);
    assert.equal(calls.includes('release-lock'), false, field);
  }
});

test('rejects missing receipts for critical firewall, network, daemon, and capture cleanup', async () => {
  const calls = [];
  const legacyAbsence = {
    containerId,
    containers: [],
    releaseArtifacts: [],
    schemaVersion: 1,
    stagingArtifacts: [],
    tokenArtifacts: [],
  };
  const failed = await cleanupRegistration(
    (operation) => {
      calls.push(operation);
      if (operation === 'remove-registration-container') return removalReceipt;
      if (operation === 'prove-registration-cleanup') return legacyAbsence;
      return undefined;
    },
    false,
    { containerId, started: true }
  );
  assert.equal(failed, true);
  assert.equal(calls.includes('disarm-watchdog'), false);
});

test('preserves terminal cleanup after the flow already verified container removal', async () => {
  const calls = [];
  const failed = await cleanupRegistration(
    (operation) => {
      calls.push(operation);
      if (operation === 'prove-registration-cleanup') return absenceReceipt;
      return cleanupReceipt(operation);
    },
    false,
    { containerId, containerRemoved: true, started: true }
  );
  assert.equal(failed, false);
  assert.equal(calls.includes('stop-registration-container'), false);
  assert.equal(calls.includes('remove-registration-container'), false);
  assert.equal(calls.includes('restore-capture'), true);
  assert.deepEqual(calls.slice(-2), ['disarm-watchdog', 'release-lock']);
});
