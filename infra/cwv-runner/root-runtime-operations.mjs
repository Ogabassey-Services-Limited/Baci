import { execFile as execFileCallback } from 'node:child_process';
import { isDeepStrictEqual, promisify } from 'node:util';

import {
  isolationProbeArgv,
  runtimeIdentityProbeArgv,
  validateIsolationProbeArgv,
  validateRuntimeIdentityProbeArgv,
} from './runtime-probe-controller.mjs';

export {
  registrationOperationNames,
  rootOperationExecutor,
} from './root-registration-operation-adapter.mjs';

const execFile = promisify(execFileCallback);
const DOCKER = '/usr/bin/docker';
const fail = () => {
  throw new TypeError('root operation refused');
};

export function rootProbeExecutor(context, resources, dependencies = {}) {
  const run = dependencies.executeFile ?? execFile;
  if (typeof run !== 'function') fail();
  return async (argv) => {
    const isolation = isolationProbeArgv(context, resources);
    const runtime = runtimeIdentityProbeArgv(context, resources);
    const selected = isDeepStrictEqual(argv, isolation)
      ? validateIsolationProbeArgv(argv, context, resources)
      : isDeepStrictEqual(argv, runtime)
        ? validateRuntimeIdentityProbeArgv(argv, context, resources)
        : fail();
    const result = await run(DOCKER, selected.slice(1));
    if (typeof result?.stdout !== 'string') fail();
    return result.stdout;
  };
}
