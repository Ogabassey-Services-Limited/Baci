import { createTestRemediationGlobalLockCapability } from './remediation-global-lock.mjs';
import { runRemediationWorker as runWorker } from './remediation-worker.mjs';

export const runRemediationWorker = (options = {}) =>
  runWorker({
    ...options,
    remediationLock:
      options.remediationLock ?? createTestRemediationGlobalLockCapability(),
  });
