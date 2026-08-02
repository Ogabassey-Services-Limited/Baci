import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import {
  publishSourceEvidence,
  readSourceEvidence,
} from './attestation-evidence-store.mjs';
import {
  buildRunnerAttestation,
  canonicalJson,
  validateSourceEnvelope,
} from './host-attestation.mjs';
import { runRegistrationController } from './registration-controller.mjs';
import { readRegistrationRootConfiguration } from './registration-root-configuration.mjs';
import {
  publishRegistrationTerminalReceipt,
  readRegistrationTerminalState,
} from './registration-terminal-receipt.mjs';
import {
  registrationOperationNames,
  rootOperationExecutor,
  rootProbeExecutor,
} from './root-runtime-operations.mjs';
import {
  recoverPostEgressRegistration,
  resumeInstalledRegistration,
} from './root-runtime-post-egress-recovery.mjs';
import { createInstalledRegistrationPreparationAdapter } from './root-runtime-registration-adapter.mjs';
import { runnerRuntimeImageEnvelope } from './runner-runtime-identity-manifest.mjs';
import { readRunnerRuntimeReceipt } from './runner-runtime-manifest-receipt-reader.mjs';
import {
  runIsolationProbe,
  runRuntimeIdentityProbe,
} from './runtime-probe-controller.mjs';

const execFile = promisify(execFileCallback);
const EVIDENCE_ROOT = '/srv/baci-cwv/evidence';
const HOST_ATTEST = '/srv/baci-cwv/sealed/host-attest.sh';
const RUNTIME_RECEIPTS = '/srv/baci-cwv/receipts/runner-runtime';
const IMAGE_RECEIPT = '/srv/baci-cwv/image-receipt.json';
const registrationSet = new Set(registrationOperationNames);
// biome-ignore format: exact public command inventory stays under the file cap.
export const rootControllerCommands = Object.freeze(['probe-isolation', 'probe-runtime-identity', 'register-token-stdin']);
const fail = () => {
  throw new TypeError('root controller refused');
};
function requireNoExtraArguments(extraArguments) {
  if (
    extraArguments !== undefined &&
    (!Array.isArray(extraArguments) || extraArguments.length !== 0)
  )
    fail();
}
function registrationDependencies(dependencies) {
  if (typeof dependencies?.executeOperation !== 'function') fail();
  if (typeof dependencies.readStdin !== 'function') fail();
  return {
    execute: (operation, payload) => {
      if (!registrationSet.has(operation)) fail();
      return dependencies.executeOperation(operation, payload);
    },
    readToken: (contract) => dependencies.readStdin(contract),
    publishTerminal: dependencies.publishTerminal,
  };
}
function probeExecutor(dependencies) {
  if (typeof dependencies?.executeProbe !== 'function') fail();
  return dependencies.executeProbe;
}
async function recordRuntimeEvidence(result, dependencies) {
  if (typeof dependencies?.publishEvidence !== 'function') return result;
  const root = dependencies.evidenceRoot ?? EVIDENCE_ROOT;
  validateSourceEnvelope('runtime', result?.envelope);
  const runtime = await dependencies.publishEvidence(
    root,
    'runtime',
    result.envelope
  );
  if (typeof dependencies.readHostEnvelope !== 'function') fail();
  const hostEnvelope = await dependencies.readHostEnvelope();
  validateSourceEnvelope('host', hostEnvelope);
  const host = await dependencies.publishEvidence(root, 'host', hostEnvelope);
  if (typeof dependencies.readImageEnvelope !== 'function') fail();
  const imageEnvelope = await dependencies.readImageEnvelope();
  validateSourceEnvelope('image', imageEnvelope);
  const image = await dependencies.publishEvidence(
    root,
    'image',
    imageEnvelope
  );
  const attestation =
    typeof dependencies.buildStableAttestation === 'function'
      ? await dependencies.buildStableAttestation(root)
      : undefined;
  return Object.freeze({
    ...result,
    attestation,
    evidence: Object.freeze({ host, image, runtime }),
  });
}
export async function runRootRuntimeController(
  command,
  context,
  resources,
  dependencies
) {
  if (!rootControllerCommands.includes(command)) fail();
  requireNoExtraArguments(dependencies?.extraArguments);
  if (command === 'register-token-stdin')
    return runRegistrationController(
      context,
      resources,
      registrationDependencies(dependencies)
    );
  const execute = probeExecutor(dependencies);
  if (command === 'probe-isolation')
    return runIsolationProbe(context, resources, execute);
  return recordRuntimeEvidence(
    await runRuntimeIdentityProbe(context, resources, execute),
    dependencies
  );
}
export async function readRootRuntimeConfiguration() {
  return await readRegistrationRootConfiguration();
}
function stdinReader({ maximumBytes, signal }) {
  if (maximumBytes !== 129 || !signal || signal.aborted) fail();
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    const done = (error, value) => {
      process.stdin.off('data', data);
      process.stdin.off('end', end);
      process.stdin.off('error', failed);
      signal.removeEventListener('abort', aborted);
      if (error) reject(error);
      else resolve(value);
    };
    const data = (chunk) => {
      if (!Buffer.isBuffer(chunk))
        return done(new TypeError('root controller refused'));
      size += chunk.length;
      if (size > maximumBytes)
        return done(new TypeError('root controller refused'));
      chunks.push(chunk);
    };
    const end = () => done(undefined, Buffer.concat(chunks));
    const failed = () => done(new TypeError('root controller refused'));
    const aborted = () => done(new TypeError('root controller refused'));
    process.stdin.on('data', data);
    process.stdin.once('end', end);
    process.stdin.once('error', failed);
    signal.addEventListener('abort', aborted, { once: true });
    process.stdin.resume();
  });
}
async function defaultHostEnvelope(executeFile) {
  const result = await executeFile(HOST_ATTEST, ['--identity-host']);
  if (typeof result?.stdout !== 'string' || result.stderr) fail();
  let envelope;
  try {
    envelope = JSON.parse(result.stdout);
  } catch {
    fail();
  }
  if (result.stdout !== `${canonicalJson(envelope)}\n`) fail();
  return envelope;
}
function defaultImageEnvelope() {
  // biome-ignore format: fixed installed receipt authority stays under the cap.
  const { context } = readRunnerRuntimeReceipt(RUNTIME_RECEIPTS, IMAGE_RECEIPT, { gid: 0, uid: 0 }, 0o600);
  return runnerRuntimeImageEnvelope({
    id: context.imageId,
    imageReceiptSha256: context.imageReceiptSha256,
    platform: context.platform,
    runtimeIdentitySha256: context.runtimeIdentitySha256,
    runtimeManifestSha256: context.runtimeManifestSha256,
    schemaVersion: 1,
  });
}
async function defaultAttestation(root) {
  const input = Object.fromEntries(
    await Promise.all(
      ['policy', 'host', 'runtime', 'github', 'service', 'image'].map(
        async (name) => [name, await readSourceEvidence(root, name)]
      )
    )
  );
  return buildRunnerAttestation(input);
}
function commandFrom(argv, campaignId) {
  if (
    argv.length === 1 &&
    ['register-token-stdin', 'probe-runtime-identity'].includes(argv[0])
  )
    return argv[0];
  if (
    argv.length === 2 &&
    argv[0] === 'probe-isolation' &&
    argv[1] === campaignId
  )
    return argv[0];
  fail();
}
export async function runInstalledRootRuntimeController(
  argv,
  dependencies = {}
) {
  const registering =
    Array.isArray(argv) &&
    argv.length === 1 &&
    argv[0] === 'register-token-stdin';
  const preparation = dependencies.prepareRegistrationCommand
    ? (name, additions = {}) =>
        dependencies.prepareRegistrationCommand(name, {
          ...dependencies.prepareDependencies,
          ...additions,
        })
    : (
        dependencies.createRegistrationPreparationAdapter ??
        createInstalledRegistrationPreparationAdapter
      )();
  const executeFile = dependencies.executeFile ?? execFile;
  if (typeof executeFile !== 'function') fail();
  const readConfiguration =
    dependencies.readConfiguration ?? readRootRuntimeConfiguration;
  const configuration = await readConfiguration();
  const command = commandFrom(argv, configuration.context?.campaignId);
  const executeOperation = rootOperationExecutor(
    configuration.context,
    configuration.resources,
    { executeBackend: dependencies.executeBackend }
  );
  const publishTerminal = registering
    ? (receipt) =>
        (
          dependencies.publishRegistrationTerminalReceipt ??
          publishRegistrationTerminalReceipt
        )(receipt, dependencies.terminalReceiptDependencies)
    : undefined;
  if (registering) {
    const readTerminal =
      dependencies.readRegistrationTerminalState ??
      readRegistrationTerminalState;
    const terminal = await resumeInstalledRegistration(
      configuration,
      executeOperation,
      dependencies,
      preparation,
      publishTerminal,
      readTerminal
    );
    if (terminal) return terminal;
  }
  if (
    registering &&
    (await recoverPostEgressRegistration(
      configuration,
      executeOperation,
      dependencies,
      preparation,
      publishTerminal
    ))
  )
    fail();
  const result = await runRootRuntimeController(
    command,
    configuration.context,
    configuration.resources,
    {
      executeOperation,
      executeProbe: rootProbeExecutor(
        configuration.context,
        configuration.resources,
        { executeFile }
      ),
      readStdin: dependencies.readStdin ?? stdinReader,
      publishTerminal,
      publishEvidence: dependencies.publishEvidence ?? publishSourceEvidence,
      readHostEnvelope:
        dependencies.readHostEnvelope ??
        (() => defaultHostEnvelope(executeFile)),
      readImageEnvelope: dependencies.readImageEnvelope ?? defaultImageEnvelope,
      buildStableAttestation:
        dependencies.buildStableAttestation ?? defaultAttestation,
      evidenceRoot: dependencies.evidenceRoot,
    }
  );
  if (registering) await preparation('finalize');
  return result;
}
if (import.meta.filename === process.argv[1]) {
  runInstalledRootRuntimeController(process.argv.slice(2))
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch(() => {
      process.stderr.write('root controller refused\n');
      process.exitCode = 65;
    });
}
