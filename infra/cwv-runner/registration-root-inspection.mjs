import { registrationLayout } from './registration-controller.mjs';
import {
  observeRegistrationIdentity,
  validateRegistrationSnapshotState,
} from './registration-controller-state.mjs';
import { createRegistrationSnapshotCollector } from './registration-root-observer.mjs';

const PHASES = new Set([
  'pre-start',
  'node-started',
  'node-ready',
  'node-token-absent',
  'listener-configure',
  'post-container',
]);
const fail = () => {
  throw new TypeError('registration inspection refused');
};

export function createRegistrationInspection(configuration, dependencies = {}) {
  const collect =
    dependencies.collect ??
    createRegistrationSnapshotCollector(configuration, dependencies);
  if (typeof collect !== 'function') fail();
  const layout = registrationLayout(configuration?.context);
  let established;
  return async (phase) => {
    if (!PHASES.has(phase)) fail();
    const snapshot = await collect(phase);
    let authority;
    if (snapshot?.containers?.length === 1) {
      const observed = observeRegistrationIdentity(
        snapshot,
        snapshot.containers[0].containerId
      );
      authority = established ?? observed;
      established ??= observed;
    }
    validateRegistrationSnapshotState(
      snapshot,
      phase,
      configuration.context,
      layout,
      authority
    );
    return snapshot;
  };
}
