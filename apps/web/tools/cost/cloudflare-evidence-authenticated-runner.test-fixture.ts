// Closed single-file adapter used to prove owner-approved post-merge runners.
export function createMutationDependencies() {
  throw new Error('test mutation runner must not execute during prepare');
}

export function createMeasurementDependencies() {
  throw new Error('test measurement runner must not execute during prepare');
}
