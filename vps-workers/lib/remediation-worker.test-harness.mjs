import { createRemediationWorker } from './remediation-worker-factory.mjs';

const testRemediationLock = {};

const runTestWorker = createRemediationWorker({
  lockCapabilityValidator: () => true,
  usesGlobalCaseStateLock: false,
});

const runTestWorkerWithGlobalCaseStateLock = createRemediationWorker({
  lockCapabilityValidator: () => true,
});

const withTestRemediationLock =
  (runWorker) =>
  (options = {}) =>
    runWorker({
      ...options,
      remediationLock: options.remediationLock ?? testRemediationLock,
    });

export const runRemediationWorker = withTestRemediationLock(runTestWorker);

export const runRemediationWorkerWithGlobalCaseStateLock =
  withTestRemediationLock(runTestWorkerWithGlobalCaseStateLock);
