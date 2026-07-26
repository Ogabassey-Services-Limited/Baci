import assert from 'node:assert/strict';
import test from 'node:test';

import {
  controllerContext,
  resourceContract,
} from './controller-contract.fixture.mjs';
import { createRegistrationSnapshotCollector } from './registration-root-observer.mjs';

test('collects normal-mode absence without inspecting container environment', async () => {
  const calls = [];
  const collect = createRegistrationSnapshotCollector(
    { context: controllerContext, resources: resourceContract },
    {
      executeFile: (file, argv, options) => {
        calls.push([file, argv, options]);
        if (file === '/bin/systemctl')
          return { stderr: '', stdout: 'inactive\ndisabled\n' };
        throw new Error('container absent');
      },
      network: {
        inspectEgress: () => ({ bytes: 0, mode: 'default-drop', packets: 0 }),
      },
    }
  );
  const snapshot = await collect('pre-start');
  assert.deepEqual(snapshot.containers, []);
  assert.deepEqual(snapshot.normalService, { active: false, enabled: false });
  assert.equal(snapshot.environmentSha256, null);
  const docker = calls.find(([file]) => file === '/usr/bin/docker');
  assert.equal(JSON.stringify(docker).includes('.Config.Env'), false);
  assert.equal(Object.keys(docker[2].env).sort().join(','), 'LC_ALL,PATH,TZ');
});
