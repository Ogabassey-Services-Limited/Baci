import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// biome-ignore format: exact source inventory stays compact under the file cap.
const SOURCE_NAMES = ['policy', 'host', 'runtime', 'github', 'service', 'image'];
const SHA256 = /^[a-f0-9]{64}$/;
const SECRET =
  /(token|secret|password|credential|cookie|private.?key|authorization)/i;
const CONTRACT = readFileSync(
  new URL('./identity-contract.json', import.meta.url)
);
const CONTRACT_VALUE = JSON.parse(CONTRACT);
const CONTRACT_SHA256 = createHash('sha256').update(CONTRACT).digest('hex');
function fail(message) {
  throw new TypeError(`runner attestation refused: ${message}`);
}
function normalized(value, seen = new Set()) {
  if (typeof value === 'string') {
    if (SECRET.test(value)) fail('secret-shaped string value');
    return value;
  }
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value || typeof value !== 'object' || seen.has(value))
    fail('invalid JSON value');
  seen.add(value);
  const result = Array.isArray(value)
    ? value.map((item) => normalized(item, seen))
    : Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => {
            if (SECRET.test(key)) fail(`secret-shaped key ${key}`);
            return [key, normalized(value[key], seen)];
          })
      );
  seen.delete(value);
  return result;
}
export function canonicalJson(value) {
  return JSON.stringify(normalized(value));
}
function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}
function exactKeys(value, keys, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail(`${name} is not an object`);
  if (
    canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())
  )
    fail(`${name} has unexpected fields`);
}
function sha(value, name) {
  if (typeof value !== 'string' || !SHA256.test(value)) fail(`invalid ${name}`);
  return value;
}

// biome-ignore format: tight security checks preserve the source cap.
export function validateSealedRunnerIdentity({ bytes, details, identityContract }) {
  const github = identityContract?.builderSources?.github;
  if (!Buffer.isBuffer(bytes) || !github || bytes.length < 1 || bytes.length > 512) fail('invalid sealed runner identity');
  if (!details?.isFile?.() || details.isSymbolicLink?.() || details.uid !== 0 || details.gid !== 10001 || details.nlink !== 1 || (details.mode & 0o777) !== 0o400) fail('sealed runner identity metadata');
  let identity;
  try { identity = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { fail('invalid sealed runner identity'); }
  exactKeys(identity, ['generation', 'id', 'name'], 'sealed runner identity');
  if (canonicalJson(identity) !== bytes.toString('utf8') || identity.generation !== github.controllerGeneration || !Number.isSafeInteger(identity.id) || identity.id <= 0 || identity.name !== github.runnerName) fail('sealed runner identity drift');
  return Object.freeze({ identity: Object.freeze(identity), sha256: digest(bytes) });
}

export function validateSourceEnvelope(name, envelope) {
  exactKeys(
    envelope,
    ['canonical', 'owner', 'schemaVersion', 'sha256Receipt', 'source'],
    `${name} envelope`
  );
  if (envelope.schemaVersion !== 1 || envelope.source !== name)
    fail(`invalid ${name} envelope`);
  exactKeys(envelope.owner, ['gid', 'mode', 'uid'], `${name} owner`);
  if (
    envelope.owner.uid !== 0 ||
    envelope.owner.gid !== 10001 ||
    envelope.owner.mode !== '0640'
  )
    fail(`${name} is not root-owned evidence`);
  if (
    typeof envelope.canonical !== 'string' ||
    !/^[a-f0-9]{64}\n$/.test(envelope.sha256Receipt)
  )
    fail(`invalid ${name} receipt`);
  let value;
  try {
    value = JSON.parse(envelope.canonical);
  } catch {
    fail(`invalid ${name} canonical JSON`);
  }
  if (canonicalJson(value) !== envelope.canonical)
    fail(`noncanonical ${name} source`);
  if (digest(envelope.canonical) !== envelope.sha256Receipt.slice(0, -1))
    fail(`${name} receipt mismatch`);
  return { value, sha256: envelope.sha256Receipt.slice(0, -1) };
}
function files(value, expected, name) {
  if (!Array.isArray(value) || value.length !== expected.length)
    fail(`invalid ${name} files`);
  const paths = value.map((file) => {
    exactKeys(file, ['path', 'sha256'], `${name} file`);
    sha(file.sha256, `${name} file hash`);
    return file.path;
  });
  if (canonicalJson(paths) !== canonicalJson(expected))
    fail(`invalid ${name} file projection`);
  return value;
}
function sourceSchemas(values) {
  const { policy, host, runtime, github, service, image } = values;
  const hostContract = CONTRACT_VALUE.builderSources.host;
  const runtimeContract = CONTRACT_VALUE.builderSources.runtime;
  const githubContract = CONTRACT_VALUE.builderSources.github;
  exactKeys(
    policy,
    ['authorityMode', 'namespace', 'policyFileSha256', 'schemaVersion'],
    'policy'
  );
  if (
    policy.schemaVersion !== 1 ||
    policy.authorityMode !== 'personal-public-exact-run' ||
    policy.namespace !== 'baci_cwv_measurement'
  )
    fail('invalid policy authority');
  sha(policy.policyFileSha256, 'policy SHA');
  exactKeys(github, ['repository', 'runner', 'schemaVersion'], 'github');
  exactKeys(github.repository, ['id', 'url'], 'github repository');
  exactKeys(
    github.runner,
    ['authorityMode', 'controllerGeneration', 'id', 'labels', 'name', 'os'],
    'github runner'
  );
  if (
    github.schemaVersion !== 1 ||
    github.repository.id !== githubContract.repositoryId ||
    github.repository.url !== 'https://github.com/ogabasseyy/Baci' ||
    github.runner.authorityMode !== policy.authorityMode ||
    github.runner.name !== githubContract.runnerName ||
    github.runner.os !== githubContract.runnerOs ||
    !Number.isSafeInteger(github.runner.id) ||
    github.runner.id <= 0 ||
    github.runner.controllerGeneration !== githubContract.controllerGeneration
  )
    fail('invalid GitHub authority');
  if (
    !Array.isArray(github.runner.labels) ||
    github.runner.labels.some((label) => typeof label !== 'string') ||
    canonicalJson(github.runner.labels) !== canonicalJson(githubContract.labels)
  )
    fail('invalid GitHub labels');
  exactKeys(host, hostContract.keys, 'host');
  exactKeys(host.hostIdentity, hostContract.frozenFields, 'host identity');
  exactKeys(host.hostRunner, ['files', 'runner'], 'host runner');
  exactKeys(
    host.hostRunner.runner,
    ['generation', 'id', 'name'],
    'host runner identity'
  );
  files(host.hostRunner.files, hostContract.runnerFiles, 'host runner');
  const fields = CONTRACT_VALUE.fields;
  const expectedHostIdentity = {
    cgroupDocker: fields.cgroupDocker.expectation,
    controlCgroup: fields.controlCgroup,
    cpuFreq: fields.cpuFreq.expectation,
    cpuSummary: fields.cpuSummary.expectation,
    cpuTopology: fields.cpuTopology.expectation,
    dns: fields.dns.expectation,
    egressProvider: fields.egressProvider.expectation,
    hostBinaries: fields.hostBinaries.expectation,
    hostname: fields.hostname.expectation,
    ipForward: fields.ipForward.expectation,
    iptables: fields.iptables.expectation,
    kernel: fields.kernel.expectation,
    locale: fields.locale.expectation,
    measurementCgroup: fields.measurementCgroup,
    memory: fields.memory.expectationKb,
    nft: {
      sha256: fields.nft.expectation.sha256,
      version: fields.nft.expectation.version,
    },
    osRelease: fields.osRelease.expectation,
    publicEgress: fields.publicEgress.expectation,
    rootFilesystem: fields.rootFilesystem.expectation,
    route: fields.route.expectation,
    timezone: fields.timezone.expectation,
  };
  if (
    host.schemaVersion !== 1 ||
    host.hostname !== hostContract.hostname ||
    canonicalJson(host.hostIdentity) !== canonicalJson(expectedHostIdentity) ||
    host.hostIdentityDigest !== digest(canonicalJson(host.hostIdentity)) ||
    host.hostRunner.runner.generation !== github.runner.controllerGeneration ||
    host.hostRunner.runner.id !== github.runner.id ||
    host.hostRunner.runner.name !== github.runner.name ||
    host.hostRunnerIdentityDigest !==
      digest(canonicalJson(host.hostRunner.runner))
  )
    fail('host runner identity mismatch');
  exactKeys(runtime, runtimeContract.keys, 'runtime');
  exactKeys(runtime.chrome, runtimeContract.chrome.keys, 'Chrome');
  exactKeys(runtime.node, runtimeContract.node.keys, 'Node');
  exactKeys(runtime.pnpm, runtimeContract.pnpm.keys, 'pnpm');
  if (
    runtime.chrome.version !== runtimeContract.chrome.version ||
    runtime.chrome.debianSha256 !== runtimeContract.chrome.debianSha256 ||
    canonicalJson(runtime.chrome.debianPackage) !==
      canonicalJson(runtimeContract.chrome.debianPackage) ||
    runtime.node.version !== runtimeContract.node.version ||
    runtime.pnpm.version !== runtimeContract.pnpm.version ||
    canonicalJson(runtime.pnpm.packageProjection) !==
      canonicalJson(runtimeContract.pnpm.packageProjection)
  )
    fail('runtime version drift');
  sha(runtime.chrome.binarySha256, 'Chrome SHA');
  sha(runtime.chrome.debianSha256, 'Chrome Debian SHA');
  sha(runtime.node.binarySha256, 'Node SHA');
  sha(runtime.pnpm.binarySha256, 'pnpm SHA');
  sha(runtime.pnpm.packageJsonSha256, 'pnpm package SHA');
  exactKeys(runtime.runtimeRunner, ['files', 'version'], 'runtime runner');
  const runtimeFiles = files(
    runtime.runtimeRunner.files,
    runtimeContract.runnerFiles,
    'runtime runner'
  );
  if (
    runtime.schemaVersion !== 1 ||
    runtime.runtimeRunner.version !== runtimeContract.runnerVersion ||
    runtime.runtimeRunnerBinaryDigest !==
      digest(canonicalJson(runtime.runtimeRunner)) ||
    runtime.runtimeRunnerBinaryDigest === host.hostRunnerIdentityDigest
  )
    fail('runtime runner identity mismatch');
  for (const runtimeFile of runtimeFiles) {
    const hostFile = host.hostRunner.files.find(
      (file) => file.path === runtimeFile.path
    );
    if (!hostFile || hostFile.sha256 !== runtimeFile.sha256)
      fail('host/runtime runner shared-file mismatch');
  }

  exactKeys(
    service,
    ['manifestSha256', 'schemaVersion', 'unitSha256'],
    'service'
  );
  if (service.schemaVersion !== 1) fail('invalid service');
  sha(service.manifestSha256, 'service manifest SHA');
  sha(service.unitSha256, 'service unit SHA');
  exactKeys(image, CONTRACT_VALUE.builderSources.image.keys, 'image');
  if (
    image.schemaVersion !== 1 ||
    image.platform !== 'linux/amd64' ||
    !/^sha256:[a-f0-9]{64}$/.test(image.id) ||
    !SHA256.test(image.imageReceiptSha256) ||
    !SHA256.test(image.runtimeManifestSha256) ||
    !SHA256.test(image.runtimeIdentitySha256)
  )
    fail('invalid image identity');
  if (runtime.imageId !== image.id) fail('runtime image mismatch');
  if (digest(canonicalJson(runtime)) !== image.runtimeIdentitySha256)
    fail('runtime identity mismatch');
}
export function buildRunnerAttestation(input) {
  exactKeys(input, SOURCE_NAMES, 'attestation inputs');
  const sourceRows = Object.fromEntries(
    SOURCE_NAMES.map((name) => [
      name,
      validateSourceEnvelope(name, input[name]),
    ])
  );
  const values = Object.fromEntries(
    SOURCE_NAMES.map((name) => [name, sourceRows[name].value])
  );
  sourceSchemas(values);
  const identity = normalized({
    contractSha256: CONTRACT_SHA256,
    github: values.github,
    host: values.host,
    image: values.image,
    policy: values.policy,
    runtime: values.runtime,
    schemaVersion: 1,
    service: values.service,
    sourceReceipts: Object.fromEntries(
      SOURCE_NAMES.map((name) => [name, sourceRows[name].sha256])
    ),
  });
  return { identity, sha256: digest(canonicalJson(identity)) };
}
