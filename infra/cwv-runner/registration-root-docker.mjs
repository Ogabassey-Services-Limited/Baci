import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';

import { registrationContainerArgv } from './registration-controller.mjs';

const execFile = promisify(execFileCallback);
const DOCKER = '/usr/bin/docker';
const CONTAINER = /^[a-f0-9]{64}$/;
const FIXED_OPTIONS = Object.freeze({
  env: Object.freeze({
    LC_ALL: 'C.UTF-8',
    PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    TZ: 'Etc/UTC',
  }),
  maxBuffer: 1_048_576,
});
const fail = () => {
  throw new TypeError('registration root operation refused');
};
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

function output(result) {
  if (
    !result ||
    typeof result.stdout !== 'string' ||
    typeof result.stderr !== 'string' ||
    result.stderr !== ''
  )
    fail();
  return result.stdout;
}

export function createRegistrationDockerOperations(
  configuration,
  run = execFile
) {
  if (typeof run !== 'function') fail();
  const prefix = [`--host=${configuration.resources.dockerSocket}`];
  return Object.freeze({
    async create() {
      const argv = registrationContainerArgv(
        configuration.context,
        configuration.resources
      );
      const stdout = output(await run(DOCKER, argv.slice(1), FIXED_OPTIONS));
      const containerId = stdout.trim();
      if (!CONTAINER.test(containerId) || stdout !== `${containerId}\n`) fail();
      return { containerId };
    },
    async inspect(containerId) {
      if (!CONTAINER.test(containerId)) fail();
      const projection =
        '{{json [ .Id, .Image, .State.Running, .HostConfig.NetworkMode, .HostConfig.CgroupParent, .HostConfig.CpusetCpus, (index .Config.Labels "baci.cwv.transaction") ]}}';
      const stdout = output(
        await run(
          DOCKER,
          [...prefix, 'inspect', '--format', projection, containerId],
          FIXED_OPTIONS
        )
      );
      let observed;
      try {
        observed = JSON.parse(stdout);
      } catch {
        fail();
      }
      if (
        !Array.isArray(observed) ||
        observed.length !== 7 ||
        observed[0] !== containerId ||
        observed[1] !== configuration.context.imageDigest ||
        observed[3] !== 'baci-cwv-net' ||
        observed[4] !== configuration.resources.cgroupParent ||
        observed[5] !== configuration.resources.cpusetCpus ||
        observed[6] !== configuration.context.campaignId
      )
        fail();
      return {
        containerId,
        createArgvSha256: digest(
          JSON.stringify(
            registrationContainerArgv(
              configuration.context,
              configuration.resources
            )
          )
        ),
        imageDigest: configuration.context.imageDigest,
      };
    },
    async start(containerId) {
      if (!CONTAINER.test(containerId)) fail();
      if (
        output(
          await run(DOCKER, [...prefix, 'start', containerId], FIXED_OPTIONS)
        ) !== `${containerId}\n`
      )
        fail();
      return {};
    },
    async stop(containerId) {
      if (!CONTAINER.test(containerId)) fail();
      if (
        output(
          await run(
            DOCKER,
            [...prefix, 'stop', '--time=10', containerId],
            FIXED_OPTIONS
          )
        ) !== `${containerId}\n`
      )
        fail();
      return {};
    },
    async remove(containerId) {
      if (!CONTAINER.test(containerId)) fail();
      if (
        output(
          await run(DOCKER, [...prefix, 'rm', containerId], FIXED_OPTIONS)
        ) !== `${containerId}\n`
      )
        fail();
      return { containerId, removed: true, schemaVersion: 1 };
    },
    async wait(containerId) {
      if (!CONTAINER.test(containerId)) fail();
      const stdout = output(
        await run(DOCKER, [...prefix, 'wait', containerId], FIXED_OPTIONS)
      );
      if (!/^(0|[1-9][0-9]*)\n$/.test(stdout)) fail();
      return {};
    },
  });
}
