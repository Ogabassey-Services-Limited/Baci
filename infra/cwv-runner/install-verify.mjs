import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { readBootstrapState } from './install-bootstrap.mjs';
import { readPrepareState } from './install-prepare-store.mjs';
import { readRegistrationRootConfiguration } from './registration-root-configuration.mjs';
import * as terminalEvidence from './registration-terminal-evidence.mjs';
import * as terminalReceipt from './registration-terminal-receipt.mjs';
import { verifyRunnerRuntimeProjection } from './runner-runtime-identity-manifest.mjs';
import { readRunnerRuntimeReceipt } from './runner-runtime-manifest-receipt-reader.mjs';
import * as runtimeProjection from './runner-runtime-projection.mjs';

const HEX = /^[0-9a-f]{64}$/;
const IMAGE = /^sha256:[0-9a-f]{64}$/;
const IMAGE_LINE = /^BACI_CWV_IMAGE_ID=(sha256:[0-9a-f]{64})\n$/;
// biome-ignore format: fixed system unit inventory stays compact under the cap.
const UNITS = ['baci-cwv-containerd.service', 'baci-cwv-docker.service', 'baci-cwv-host-sampler.service', 'baci-cwv-host-sampler.timer', 'baci-cwv-measurement.service'];
const execFile = promisify(execFileCallback);
const fail = (message) => {
  throw new TypeError(message);
};
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonical = (value) => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string')
    return JSON.stringify(value);
  if (typeof value === 'number' && Number.isSafeInteger(value))
    return String(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (!value || typeof value !== 'object') fail('invalid canonical value');
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
    .join(',')}}`;
};
export function serviceStateDigest(input) {
  const registration = terminalReceipt.serviceRegistrationState(
    input?.registrationComplete,
    input?.runnerIdentitySha256
  );
  // biome-ignore format: closed verification receipt keys stay under the cap.
  const keys = ['bootstrapReceiptSha256', 'campaignStateSha256', 'dedicatedRuntimeActive', 'imageId', 'imageReceiptSha256', 'registrationComplete', 'runnerIdentitySha256', 'runtimeContextSha256', 'runtimeManifestSha256', 'serviceFilesSha256', 'servicesDisabled'];
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    JSON.stringify(Object.keys(input).sort()) !==
      JSON.stringify([...keys].sort()) ||
    !HEX.test(input.bootstrapReceiptSha256) ||
    !HEX.test(input.campaignStateSha256) ||
    !HEX.test(input.imageReceiptSha256) ||
    !HEX.test(input.runtimeContextSha256) ||
    !HEX.test(input.runtimeManifestSha256) ||
    !HEX.test(input.serviceFilesSha256) ||
    !IMAGE.test(input.imageId) ||
    input.servicesDisabled !== true ||
    input.dedicatedRuntimeActive !== false
  )
    fail('disabled exact service state required');
  const value = {
    bootstrapReceiptSha256: input.bootstrapReceiptSha256,
    campaignStateSha256: input.campaignStateSha256,
    dedicatedRuntimeActive: false,
    imageId: input.imageId,
    imageReceiptSha256: input.imageReceiptSha256,
    ...registration,
    runtimeContextSha256: input.runtimeContextSha256,
    runtimeManifestSha256: input.runtimeManifestSha256,
    schemaVersion: 1,
    serviceFilesSha256: input.serviceFilesSha256,
    servicesDisabled: true,
  };
  const bytes = JSON.stringify(value);
  return {
    value,
    bytes,
    sha256: sha256(bytes),
  };
}
export function deriveLiveServiceState(input) {
  const match = IMAGE_LINE.exec(input.imageIdLine);
  let registration;
  // biome-ignore format: reclassify closed helper failures without expanding the verifier.
  try { registration = terminalEvidence.terminalServiceRegistration(input.registration, input.registrationAuthority); } catch { fail('registration terminal binding mismatch'); }
  if (
    input.bootstrap?.phase !== 'complete' ||
    input.bootstrap.receipt?.disabled !== true ||
    !HEX.test(input.bootstrap.receiptSha256) ||
    input.prepare?.phase !== 'target-accepted' ||
    !HEX.test(input.prepare.stateSha256) ||
    !IMAGE.test(input.prepare.imageId) ||
    !HEX.test(input.prepare.expected?.receiptSha256) ||
    !match ||
    match[1] !== input.prepare.imageId ||
    !HEX.test(input.imageIdReceipt) ||
    input.imageIdReceipt !== input.computedImageIdReceipt ||
    !HEX.test(input.runtimeReceipt?.contextSha256) ||
    !HEX.test(input.runtimeReceipt?.manifestSha256) ||
    input.runtimeReceipt?.imageId !== input.prepare.imageId
  )
    fail('accepted image state mismatch');
  // biome-ignore format: the terminal image comparison is intentionally one atomic predicate.
  if (input.registration.registrationComplete && input.registration.imageDigest !== input.prepare.imageId)
    fail('registration terminal binding mismatch');
  if (
    input.dedicatedSocketExists !== false ||
    !Array.isArray(input.unitStates) ||
    input.unitStates.length === 0
  )
    fail('dedicated runtime must be absent');
  for (const unit of input.unitStates) {
    if (
      !unit ||
      typeof unit.name !== 'string' ||
      unit.active !== 'inactive' ||
      !['disabled', 'static'].includes(unit.enabled)
    )
      fail('disabled inactive unit state required');
  }
  const serviceFiles = Object.fromEntries(
    Object.entries(input.bootstrap.receipt.files ?? {})
      .filter(
        ([path]) =>
          path.startsWith('/etc/systemd/system/') ||
          path.startsWith('/etc/baci-cwv/')
      )
      .sort(([left], [right]) => left.localeCompare(right))
  );
  if (Object.keys(serviceFiles).length === 0)
    fail('service projection required');
  return serviceStateDigest({
    bootstrapReceiptSha256: input.bootstrap.receiptSha256,
    campaignStateSha256: input.prepare.stateSha256,
    dedicatedRuntimeActive: false,
    imageId: input.prepare.imageId,
    imageReceiptSha256: input.prepare.expected.receiptSha256,
    ...registration,
    runtimeContextSha256: input.runtimeReceipt.contextSha256,
    runtimeManifestSha256: input.runtimeReceipt.manifestSha256,
    serviceFilesSha256: sha256(canonical(serviceFiles)),
    servicesDisabled: true,
  });
}
async function rootFile(path, mode) {
  const info = await lstat(path);
  if (
    !info.isFile() ||
    info.isSymbolicLink() ||
    info.uid !== 0 ||
    info.gid !== 0 ||
    (info.mode & 0o777) !== mode
  )
    fail('root-owned service receipt required');
  return readFile(path, 'utf8');
}
async function unitState(name) {
  const { stdout } = await execFile('/bin/systemctl', [
    'show',
    '--property=ActiveState',
    '--property=UnitFileState',
    name,
  ]);
  const values = Object.fromEntries(
    stdout
      .trim()
      .split('\n')
      .map((row) => row.split('=', 2))
  );
  return { name, active: values.ActiveState, enabled: values.UnitFileState };
}
async function socketExists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}
// biome-ignore format: exact installed evidence view stays compact under the cap.
export async function readLiveServiceState(
  root,
  bootstrapDirectory,
  prepareRoot
) {
  const bootstrap = await readBootstrapState(bootstrapDirectory);
  const accepted = [];
  for (const name of await readdir(prepareRoot)) {
    if (!/^prepare-[a-z0-9][a-z0-9-]{0,52}$/.test(name)) continue;
    const state = await readPrepareState(join(prepareRoot, name));
    if (state.phase === 'target-accepted') {
      accepted.push({
        ...state,
        directory: join(prepareRoot, name),
      });
    }
  }
  if (accepted.length !== 1)
    fail('exactly one accepted prepare state required');
  const imageIdLine = await rootFile(join(root, 'image-id'), 0o644);
  const imageIdReceipt = (
    await rootFile(join(root, 'image-id.sha256'), 0o644)
  ).trim();
  const imageId = await runtimeProjection.readRunnerImageId({
    path: join(root, 'image-id'),
    receiptPath: join(root, 'image-id.sha256'),
  });
  const receiptRoot = join(root, 'receipts');
  const runtimeReceiptRoot = join(receiptRoot, 'runner-runtime');
  const stagedImageReceiptPath = join(
    accepted[0].directory,
    'runner-runtime-image-receipt.json'
  );
  const runtime = readRunnerRuntimeReceipt(
    runtimeReceiptRoot,
    stagedImageReceiptPath
  );
  const strictManifest = await runtimeProjection.readRunnerRuntimeManifest(imageId, {
    path: join(runtimeReceiptRoot, 'runner-runtime-manifest.json'),
    receiptPath: join(runtimeReceiptRoot, 'runner-runtime-manifest.json.sha256'),
  });
  const [imageReceipt, imageReceiptSha, stagedImageReceipt, context, manifest, identityManifest, identityContract] = await Promise.all([
    rootFile(join(root, 'image-receipt.json'), 0o600),
    rootFile(join(root, 'image-receipt.sha256'), 0o600),
    rootFile(stagedImageReceiptPath, 0o400),
    rootFile(join(runtimeReceiptRoot, 'runner-runtime-context.json'), 0o400),
    rootFile(join(runtimeReceiptRoot, 'runner-runtime-manifest.json'), 0o400),
    rootFile(join(runtimeReceiptRoot, 'runner-runtime-identity-manifest.json'), 0o400),
    readFile(new URL('./identity-contract.json', import.meta.url)),
  ]);
  if (
    runtime.manifest.imageId !== strictManifest.imageId ||
    imageReceipt !== stagedImageReceipt ||
    imageReceiptSha !== `${sha256(imageReceipt)}\n` ||
    sha256(imageReceipt) !== accepted[0].expected.receiptSha256
  )
    fail('runtime receipt binding mismatch');
  const projectionRoot = join(root, 'sealed/runtime-runner-binaries');
  const runnerFiles = await Promise.all(
    ['bin/Runner.Listener', 'bin/Runner.Worker', 'entrypoint.mjs'].map(async (path) => {
        const bytes = await readFile(join(projectionRoot, path));
        const expected = runtime.manifest.files.find((row) => row.path === path);
        if (!expected || expected.sha256 !== sha256(bytes))
          fail('runtime projection binding mismatch');
        return { bytes, path, sha256: expected.sha256 };
    })
  );
  await verifyRunnerRuntimeProjection(
    projectionRoot,
    { identityContractBytes: identityContract, runnerFiles, runtimeManifestBytes: Buffer.from(identityManifest) },
    { gid: 0, uid: 0 }
  );
  const registration = await terminalReceipt.readRegistrationTerminalState();
  const configuration = registration.registrationComplete
    ? await readRegistrationRootConfiguration()
    : undefined;
  const registrationAuthority = configuration
    ? await terminalEvidence.readRegistrationTerminalEvidence({
        campaignId: configuration.context.campaignId,
        captureSha256: configuration.context.captureSha256,
        imageDigest: configuration.context.imageDigest,
        registrationNonce: configuration.context.registrationNonce,
        releaseNonce: configuration.context.releaseNonce,
      })
    : null;
  return deriveLiveServiceState({
    bootstrap,
    prepare: accepted[0],
    imageIdLine,
    imageIdReceipt,
    computedImageIdReceipt: sha256(imageIdLine),
    runtimeReceipt: {
      contextSha256: sha256(context),
      imageId: runtime.manifest.imageId,
      manifestSha256: sha256(manifest),
    },
    registration,
    registrationAuthority,
    unitStates: await Promise.all(UNITS.map(unitState)),
    dedicatedSocketExists: await socketExists('/run/baci-cwv/docker.sock'),
  });
}
async function main(argv) {
  if (argv[0] !== 'live' || argv.length !== 4) fail('invalid verify command');
  const result = await readLiveServiceState(argv[1], argv[2], argv[3]);
  process.stdout.write(
    `${canonical({ serviceState: result.value, sha256: result.sha256 })}\n`
  );
}
if (import.meta.filename === process.argv[1]) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
