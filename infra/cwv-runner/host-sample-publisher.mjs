import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { publishEvidenceFile } from './attestation-evidence-store.mjs';
import { canonicalJson } from './canonical-json.mjs';

const execFile = promisify(execFileCallback);
const CAMPAIGN = /^[a-z0-9][a-z0-9-]{0,62}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const EVIDENCE_ROOT = '/srv/baci-cwv/evidence';
const MAX_COLLECTOR_GAP_NANOSECONDS = 15_000_000_000n;
const BINDING_KEYS = Object.freeze([
  'accountingIdentitySha256',
  'accountingTable',
  'campaignId',
  'campaignMark',
  'captureSha256',
  'externalIfindex',
  'externalInterface',
  'generation',
  'policySha256',
  'runnerContainerId',
  'runnerIp',
  'runnerPeerIfindex',
  'runnerVeth',
]);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const fail = (message) => {
  throw new TypeError(message);
};
const exactKeys = (value, keys) =>
  value &&
  typeof value === 'object' &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const text = (value) => typeof value === 'string' && value.length > 0;
const validBinding = (value) =>
  value &&
  typeof value === 'object' &&
  SHA256.test(value.accountingIdentitySha256) &&
  text(value.accountingTable) &&
  CAMPAIGN.test(value.campaignId) &&
  Number.isSafeInteger(value.campaignMark) &&
  value.campaignMark >= 0 &&
  value.campaignMark <= 0xffffffff &&
  SHA256.test(value.captureSha256) &&
  Number.isSafeInteger(value.externalIfindex) &&
  value.externalIfindex > 0 &&
  text(value.externalInterface) &&
  Number.isSafeInteger(value.generation) &&
  value.generation > 0 &&
  SHA256.test(value.policySha256) &&
  SHA256.test(value.runnerContainerId) &&
  text(value.runnerIp) &&
  Number.isSafeInteger(value.runnerPeerIfindex) &&
  value.runnerPeerIfindex > 0 &&
  text(value.runnerVeth);
const validTimestamp = (value) =>
  typeof value === 'string' &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString() === value;

export function buildLiveSample(input) {
  if (
    !CAMPAIGN.test(input?.campaignId) ||
    !validTimestamp(input.capturedAt) ||
    input.idle?.accepted !== true ||
    input.idle.campaignId !== input.campaignId ||
    input.idle.mode !== 'live' ||
    input.host?.schemaVersion !== 1 ||
    input.host.campaignId !== input.campaignId ||
    !exactKeys(input.idle.binding, BINDING_KEYS) ||
    !validBinding(input.idle.binding) ||
    !exactKeys(input.host, [
      ...BINDING_KEYS,
      'liveIdentity',
      'schemaVersion',
    ]) ||
    !validBinding(input.host) ||
    BINDING_KEYS.some((key) => input.idle.binding[key] !== input.host[key])
  )
    fail('campaign-bound successful collectors required');
  assertLiveHostIdentity(input.host, input.campaignId, input.idle);
  const idleBytes = canonicalJson(input.idle);
  const hostBytes = canonicalJson(input.host);
  return {
    schemaVersion: 1,
    capturedAt: input.capturedAt,
    campaignId: input.campaignId,
    collectors: {
      host: { ok: true, sha256: sha256(hostBytes) },
      idle: { ok: true, sha256: sha256(idleBytes) },
    },
    host: input.host,
    idle: input.idle,
  };
}

export { assertEvidenceDirectoryDetails } from './attestation-evidence-store.mjs';

function assertLiveHostIdentity(host, campaignId, idle) {
  const identity = host?.liveIdentity;
  const container = identity?.container;
  const classifier = identity?.classifier;
  if (
    !identity ||
    Object.keys(identity).sort().join(',') !==
      'classifier,container,idleContainerSha256,nftSha256' ||
    !container ||
    Object.keys(container).sort().join(',') !==
      'cgroup,expectedImage,expectedNetwork,id,image,networkMode,pid,running' ||
    !classifier ||
    Object.keys(classifier).sort().join(',') !== 'handle,sha256' ||
    container.id !== host.runnerContainerId ||
    container.image !== container.expectedImage ||
    container.networkMode !== container.expectedNetwork ||
    container.expectedNetwork !== 'baci-cwv-net' ||
    container.running !== true ||
    !Number.isSafeInteger(container.pid) ||
    container.pid < 2 ||
    typeof container.cgroup !== 'string' ||
    !container.cgroup.startsWith('/cwv-measurement.slice/') ||
    !/^sha256:[a-f0-9]{64}$/.test(container.image) ||
    !Number.isSafeInteger(classifier.handle) ||
    classifier.handle < 1 ||
    !SHA256.test(classifier.sha256) ||
    !SHA256.test(identity.idleContainerSha256) ||
    !SHA256.test(identity.nftSha256) ||
    identity.idleContainerSha256 !== idle.evidence?.container?.end ||
    identity.nftSha256 !== idle.evidence?.nft?.end ||
    host.campaignId !== campaignId
  )
    fail('live host identity drift');
}

export async function publishLiveSample(root, sample, options = {}) {
  const published = await publishEvidenceFile(
    root,
    'live-sample.json',
    Buffer.from(canonicalJson(sample)),
    options
  );
  return published.path;
}

async function collect(path, args) {
  const { stdout, stderr } = await execFile(path, args, {
    encoding: 'utf8',
    maxBuffer: 2 ** 20,
    timeout: 25_000,
  });
  if (stderr || !stdout.endsWith('\n') || stdout.slice(0, -1).includes('\n'))
    fail('collector output invalid');
  return JSON.parse(stdout);
}

function assertFreshIdleCollector(idle, monotonicNow) {
  const end = idle?.evidence?.boundaries?.endMonotonicNanoseconds;
  if (typeof end !== 'string' || !/^\d+$/.test(end))
    fail('idle collector freshness evidence required');
  const age = monotonicNow - BigInt(end);
  if (age < 0n || age > MAX_COLLECTOR_GAP_NANOSECONDS)
    fail('idle collector freshness drift');
}

export async function collectLiveSample(
  campaignId,
  collector = collect,
  monotonicNow = process.hrtime.bigint,
  now = () => new Date()
) {
  const idle = await collector('/srv/baci-cwv/sealed/host-idle-check.sh', [
    '--live-local',
    campaignId,
  ]);
  assertFreshIdleCollector(idle, monotonicNow());
  const host = await collector('/srv/baci-cwv/sealed/host-attest.sh', [
    '--live-local',
    campaignId,
  ]);
  assertFreshIdleCollector(idle, monotonicNow());
  const capturedAt = now();
  if (!(capturedAt instanceof Date) || Number.isNaN(capturedAt.getTime()))
    fail('controlled collection clock required');
  return buildLiveSample({
    campaignId,
    capturedAt: capturedAt.toISOString(),
    idle,
    host,
  });
}

async function main(argv) {
  if (argv[0] !== 'live' || argv.length !== 2 || !CAMPAIGN.test(argv[1]))
    fail('invalid live sampler command');
  const campaignId = argv[1];
  await publishLiveSample(EVIDENCE_ROOT, await collectLiveSample(campaignId));
}

if (import.meta.filename === process.argv[1]) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
