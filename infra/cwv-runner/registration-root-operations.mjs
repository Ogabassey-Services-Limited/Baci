import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import {
  registrationContainerArgv,
  registrationLayout,
} from './registration-controller.mjs';
import { readRegistrationRootConfiguration } from './registration-root-configuration.mjs';
import {
  canonicalRegistrationJson,
  parseRegistrationRootRequest,
  validateRegistrationRootContext,
} from './registration-root-contract.mjs';
import { createRegistrationDockerOperations } from './registration-root-docker.mjs';
import { createRegistrationRootFilesystem } from './registration-root-filesystem.mjs';
import { createRegistrationInspection } from './registration-root-inspection.mjs';
import { createRegistrationNetworkOperations } from './registration-root-network.mjs';
import { createRegistrationResourceJournal } from './registration-root-receipts.mjs';
import { createRegistrationSystemOperations } from './registration-root-system.mjs';
import { readRegistrationTokenFd } from './registration-token-fd.mjs';

const execFile = promisify(execFileCallback);
const CONTAINER = /^[a-f0-9]{64}$/;
const fail = () => {
  throw new TypeError('registration root operation refused');
};
const empty = new Set([
  'create-token-layout',
  'create-staging-layout',
  'create-release-layout',
]);

function requireConfiguration(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(',') !== 'context,resources'
  )
    fail();
  registrationLayout(value.context);
  registrationContainerArgv(value.context, value.resources);
  return value;
}

function requireCampaign(context, configuration) {
  if (
    'campaignId' in context &&
    context.campaignId !== configuration.context.campaignId
  )
    fail();
}

function requireContainer(context, expected) {
  if (
    !CONTAINER.test(context.containerId ?? '') ||
    (expected && context.containerId !== expected)
  )
    fail();
  return context.containerId;
}

export function createRegistrationRootBackend(
  configurationValue,
  dependencies = {}
) {
  const configuration = requireConfiguration(configurationValue);
  const run = dependencies.executeFile ?? execFile;
  const files =
    dependencies.files ??
    createRegistrationRootFilesystem(configuration, { executeFile: run });
  const docker = createRegistrationDockerOperations(configuration, run);
  const journal =
    dependencies.journal ??
    createRegistrationResourceJournal(configuration, files, dependencies);
  const network =
    dependencies.network ??
    createRegistrationNetworkOperations(configuration, { executeFile: run });
  const inspect =
    dependencies.inspect ??
    createRegistrationInspection(configuration, {
      ...dependencies,
      executeFile: run,
      network,
    });
  const clock =
    dependencies.monotonicMilliseconds ??
    (() => Number(process.hrtime.bigint() / 1_000_000n));
  const readTokenFd = dependencies.readTokenFd ?? readRegistrationTokenFd;
  const system =
    dependencies.system ??
    (files.paths
      ? createRegistrationSystemOperations(configuration, {
          ...dependencies,
          executeFile: run,
          files,
          network,
        })
      : async () => fail());
  if (
    typeof run !== 'function' ||
    !files ||
    typeof files !== 'object' ||
    typeof clock !== 'function' ||
    typeof readTokenFd !== 'function'
  )
    fail();
  const fileOperation = async (method, ...arguments_) => {
    if (typeof files[method] !== 'function') fail();
    await files[method](...arguments_);
    return {};
  };
  const systemOperation = async (operation, context) => {
    if (typeof system !== 'function') fail();
    const result = await system(operation, context);
    if (!result || typeof result !== 'object' || Array.isArray(result)) fail();
    return result;
  };
  return async (operation, context = {}) => {
    validateRegistrationRootContext(operation, context);
    requireCampaign(context, configuration);
    if (empty.has(operation)) {
      const method = operation
        .split('-')
        .map((part, index) =>
          index === 0 ? part : `${part[0].toUpperCase()}${part.slice(1)}`
        )
        .join('');
      await fileOperation(method);
      if (operation === 'create-staging-layout') await journal.stagingCreated();
      if (operation === 'create-token-layout')
        await journal.tokenLayoutCreated();
      if (operation === 'create-release-layout')
        await journal.releaseLayoutCreated();
      return {};
    }
    if (operation === 'write-registration-token') {
      const bytes = readTokenFd(3);
      try {
        await fileOperation('writeToken', bytes);
        await journal.tokenCreated();
        return {};
      } finally {
        bytes.fill(0);
      }
    }
    if (operation === 'create-registration-container') {
      const created = await docker.create();
      await journal.containerCreated(created);
      return created;
    }
    if (operation === 'inspect-registration-config') {
      return docker.inspect(requireContainer(context));
    }
    if (
      ['start-registration-container', 'stop-registration-container'].includes(
        operation
      )
    ) {
      const containerId = requireContainer(context);
      return operation.startsWith('start')
        ? docker.start(containerId)
        : docker.stop(containerId);
    }
    if (operation === 'remove-registration-container') {
      return docker.remove(requireContainer(context));
    }
    if (operation === 'inspect-registration') {
      if (typeof inspect !== 'function') fail();
      const result = await inspect(context.phase, configuration);
      if (!result || typeof result !== 'object' || result.schemaVersion !== 1)
        fail();
      return result;
    }
    if (operation === 'monotonic-milliseconds') {
      const value = clock();
      if (!Number.isSafeInteger(value) || value < 0) fail();
      return { value };
    }
    if (operation === 'publish-release-once') {
      return fileOperation('publishRelease', context.bytes, context.sha256)
        .then(() => journal.releaseCreated())
        .then(() => ({ published: true }));
    }
    if (operation === 'verify-release-file') {
      if (typeof files.verifyRelease !== 'function') fail();
      await files.verifyRelease(context.sha256);
      return {};
    }
    if (operation === 'delete-release-file')
      return fileOperation('deleteReleaseFile');
    if (operation === 'prove-release-absence')
      return fileOperation('proveReleaseAbsence');
    // biome-ignore format: direct live receipts must not be replaced by configuration echoes
    if (operation === 'delete-token-layout')
      return files.deleteTokenLayout();
    // biome-ignore format: direct live absence receipt remains a one-step dispatch
    if (operation === 'prove-token-absence')
      return files.proveTokenAbsence();
    if (operation === 'delete-release-layout')
      return fileOperation('deleteReleaseLayout');
    if (operation === 'delete-staging-layout')
      return fileOperation('deleteStagingLayout');
    if (operation === 'wait-registration-exit')
      return systemOperation(operation, context);
    return systemOperation(operation, context);
  };
}

export async function executeRegistrationRootRequest(bytes, dependencies = {}) {
  const request = parseRegistrationRootRequest(bytes);
  const readConfiguration =
    dependencies.readConfiguration ?? readRegistrationRootConfiguration;
  if (typeof readConfiguration !== 'function') fail();
  const backend = createRegistrationRootBackend(
    await readConfiguration(),
    dependencies
  );
  return backend(request.operation, request.context);
}

export function registrationRootOutput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
  return `${canonicalRegistrationJson(value)}\n`;
}

export function readRegistrationRootInput(stream = process.stdin) {
  if (!stream || typeof stream.on !== 'function') fail();
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      stream.off('data', data);
      stream.off('end', end);
      stream.off('error', errorEvent);
      if (error) reject(error);
      else resolve(value);
    };
    const data = (chunk) => {
      if (!Buffer.isBuffer(chunk)) return finish(new TypeError('refused'));
      size += chunk.length;
      if (size > 16_384) return finish(new TypeError('refused'));
      chunks.push(chunk);
    };
    const end = () => finish(undefined, Buffer.concat(chunks));
    const errorEvent = () => finish(new TypeError('refused'));
    stream.on('data', data);
    stream.once('end', end);
    stream.once('error', errorEvent);
    stream.resume?.();
  });
}

export async function runRegistrationRootCli(argv, dependencies = {}) {
  const stderr = dependencies.stderr ?? process.stderr;
  const stdout = dependencies.stdout ?? process.stdout;
  try {
    if (!Array.isArray(argv) || argv.length !== 1 || argv[0] !== '--execute')
      fail();
    const bytes = await (dependencies.readInput ?? readRegistrationRootInput)();
    const value = await (
      dependencies.executeRequest ?? executeRegistrationRootRequest
    )(bytes);
    stdout.write(registrationRootOutput(value));
    return 0;
  } catch {
    stderr.write('registration root operation refused\n');
    return 65;
  }
}

if (import.meta.filename === process.argv[1]) {
  import('./registration-root-request-stream.mjs').then(
    ({ runRegistrationRootServer }) =>
      runRegistrationRootServer(process.argv.slice(2)).then((code) => {
        process.exitCode = code;
      })
  );
}
