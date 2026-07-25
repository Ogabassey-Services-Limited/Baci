import assert from 'node:assert/strict';
import test from 'node:test';

import { assertIdentity } from './host-idle-validation.mjs';

const input = () => ({
  campaignId: 'campaign-001',
  family: 'inet',
  identity: {
    campaignMark: 1,
    chainHandles: {},
    externalInterface: 'eth0',
    family: 'inet',
    handles: {},
    readyForSampling: true,
    runnerInterface: 'veth0',
    schemaVersion: 1,
    table: 'baci_cwv_measurement',
    tableHandle: 1,
  },
  mode: 'live',
  networkAccounting: {
    classifyChain: 'classify',
    classifyHook: 'forward',
    classifyPriority: -150,
    counterPriority: 0,
    egressChain: 'egress',
    egressHook: 'postrouting',
    hostEgressChain: 'host-egress',
    hostIngressChain: 'host-ingress',
    hostIngressHook: 'input',
    ingressChain: 'ingress',
    ingressHook: 'forward',
  },
  ruleCommentPrefix: 'baci-cwv:',
  runtime: {
    campaignId: 'campaign-001',
    campaignMark: 1,
    externalIfindex: 2,
    externalInterface: 'eth0',
    generation: 1,
    runnerContainerId: 'a'.repeat(64),
    runnerImage: `sha256:${'b'.repeat(64)}`,
    runnerNetwork: 'baci-cwv-net',
    runnerPeerIfindex: 3,
    runnerVeth: 'veth0',
  },
  table: 'baci_cwv_measurement',
});

test('rejects missing campaign and interface identities without RegExp coercion', () => {
  for (const mutate of [
    (value) => {
      value.campaignId = undefined;
      value.runtime.campaignId = undefined;
    },
    (value) => {
      value.identity.externalInterface = undefined;
      value.runtime.externalInterface = undefined;
    },
    (value) => {
      value.runtime.runnerVeth = undefined;
      value.identity.runnerInterface = undefined;
    },
  ]) {
    const value = input();
    mutate(value);
    assert.throws(() => assertIdentity(value), /identity/);
  }
});
