import { runRemediationWorker as runWorker } from './remediation-worker.mjs';

const testRemediationLock = {};
const isTestRemediationLock = (value) => value === testRemediationLock;

export const withTestRemediationLock = (options = {}) => ({
  ...options,
  lockCapabilityValidator:
    options.lockCapabilityValidator ?? isTestRemediationLock,
  remediationLock: options.remediationLock ?? testRemediationLock,
});

export const runRemediationWorker = (options = {}) =>
  runWorker(withTestRemediationLock(options));
