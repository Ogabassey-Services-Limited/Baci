import assert from 'node:assert/strict';
import test from 'node:test';

import {
  controllerContext,
  registrationSnapshot,
  resourceContract,
} from './controller-contract.fixture.mjs';
import { registrationLayout } from './registration-controller.mjs';

const moduleUrl = new URL(
  './registration-root-inspection.mjs',
  import.meta.url
);
const configuration = {
  context: controllerContext,
  resources: resourceContract,
};

test('validates every collected phase snapshot and same-PID authority', async () => {
  const { createRegistrationInspection } = await import(moduleUrl);
  const layout = registrationLayout(controllerContext);
  const inspect = createRegistrationInspection(configuration, {
    collect: (phase) => registrationSnapshot(phase, layout),
  });
  for (const phase of [
    'pre-start',
    'node-started',
    'node-ready',
    'node-token-absent',
    'listener-configure',
    'post-container',
  ])
    assert.equal((await inspect(phase)).schemaVersion, 1);
});

test('refuses PID, namespace, mount, cgroup, phase, or normal-service drift', async () => {
  const { createRegistrationInspection } = await import(moduleUrl);
  const layout = registrationLayout(controllerContext);
  let currentPhase = 'node-started';
  const samePid = createRegistrationInspection(configuration, {
    collect: () => {
      const snapshot = structuredClone(
        registrationSnapshot(currentPhase, layout)
      );
      if (currentPhase === 'node-ready')
        snapshot.containers[0].processes[0].pid += 1;
      return snapshot;
    },
  });
  await samePid('node-started');
  currentPhase = 'node-ready';
  await assert.rejects(samePid('node-ready'), /registration inventory refused/);
  for (const mutate of [
    (snapshot) => {
      snapshot.containers[0].mountNamespace = 'mnt:[999]';
    },
    (snapshot) => {
      snapshot.containers[0].mounts[0].source = '/tmp/escape';
    },
    (snapshot) => {
      snapshot.identity.cgroupPath = '/sys/fs/cgroup/system.slice/escape';
    },
    (snapshot) => {
      snapshot.normalService.active = true;
    },
  ]) {
    const inspect = createRegistrationInspection(configuration, {
      collect: () => {
        const snapshot = structuredClone(
          registrationSnapshot('node-started', layout)
        );
        mutate(snapshot);
        return snapshot;
      },
    });
    await assert.rejects(
      inspect('node-started'),
      /registration inventory refused/
    );
  }
  const inspect = createRegistrationInspection(configuration, {
    collect: () => registrationSnapshot('pre-start', layout),
  });
  await assert.rejects(inspect('assigned'), /registration inspection refused/);
});
