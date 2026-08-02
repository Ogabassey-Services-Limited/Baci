import assert from 'node:assert/strict';
import test from 'node:test';

import {
  controllerContext,
  resourceContract,
} from './controller-contract.fixture.mjs';
import { registrationContainerArgv } from './registration-controller.mjs';
import { createRegistrationDockerOperations } from './registration-root-docker.mjs';

const containerId = 'a'.repeat(64);
const configuration = {
  context: controllerContext,
  resources: resourceContract,
};
const observation = (transaction = controllerContext.campaignId) =>
  `${JSON.stringify([
    containerId,
    controllerContext.imageDigest,
    false,
    'baci-cwv-net',
    resourceContract.cgroupParent,
    resourceContract.cpusetCpus,
    transaction,
  ])}\n`;

test('inspect binds the created container to the exact transaction label', async () => {
  assert.ok(
    registrationContainerArgv(controllerContext, resourceContract).includes(
      `--label=baci.cwv.transaction=${controllerContext.campaignId}`
    )
  );
  const docker = createRegistrationDockerOperations(
    configuration,
    async () => ({ stderr: '', stdout: observation() })
  );
  assert.equal((await docker.inspect(containerId)).containerId, containerId);

  const substituted = createRegistrationDockerOperations(
    configuration,
    async () => ({ stderr: '', stdout: observation('other-campaign') })
  );
  await assert.rejects(
    substituted.inspect(containerId),
    /registration root operation refused/
  );
});
