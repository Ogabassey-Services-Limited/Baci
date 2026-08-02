import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const HEX = /^[0-9a-f]{64}$/;
const CONTROL = /^0::\/cwv-measurement-control\.slice(?:\/[A-Za-z0-9_.@:-]+)*$/;
const EXECUTABLES = new Set([
  '/usr/bin/containerd',
  '/usr/bin/containerd-shim-runc-v2',
  '/usr/bin/docker',
  '/usr/bin/dockerd',
  '/usr/bin/runc',
  '/usr/sbin/runc',
]);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const exact = (value, keys) =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  JSON.stringify(Object.keys(value).sort()) ===
    JSON.stringify([...keys].sort());

function fail() {
  throw new Error('prepare supervisor safety breach');
}

function validThresholds(value) {
  return (
    exact(value, [
      'availableMemoryBytesMin',
      'rootFreeBytesMin',
      'cpuPsiFullAvg10Max',
      'memoryPsiFullAvg10Max',
      'ioPsiFullAvg10Max',
    ]) &&
    Object.values(value).every(
      (number) => Number.isFinite(number) && number >= 0
    )
  );
}

function validPsi(value) {
  return (
    exact(value, ['cpu', 'memory', 'io']) &&
    Object.values(value).every(
      (number) => Number.isFinite(number) && number >= 0
    )
  );
}

function validWorker(worker) {
  return (
    exact(worker, ['pid', 'executable', 'cgroup']) &&
    Number.isInteger(worker.pid) &&
    worker.pid > 1 &&
    EXECUTABLES.has(worker.executable) &&
    typeof worker.cgroup === 'string' &&
    CONTROL.test(worker.cgroup)
  );
}

export function verifyPrepareSupervisorSample(baseline, sample) {
  if (
    !exact(baseline, [
      'campaignCaptureSha256',
      'productionIdentitySha256',
      'firewallIdentitySha256',
      'dedicatedSocket',
      'sampleSeconds',
      'thresholds',
    ]) ||
    ![
      baseline.campaignCaptureSha256,
      baseline.productionIdentitySha256,
      baseline.firewallIdentitySha256,
    ].every((value) => HEX.test(value)) ||
    baseline.dedicatedSocket !== '/run/baci-cwv/docker.sock' ||
    baseline.sampleSeconds !== 2 ||
    !validThresholds(baseline.thresholds) ||
    !exact(sample, [
      'elapsedMilliseconds',
      'campaignCaptureSha256',
      'productionIdentitySha256',
      'firewallIdentitySha256',
      'dedicatedSocket',
      'availableMemoryBytes',
      'rootFreeBytes',
      'psi',
      'workers',
    ]) ||
    !Number.isFinite(sample.elapsedMilliseconds) ||
    sample.elapsedMilliseconds < 0 ||
    sample.elapsedMilliseconds > baseline.sampleSeconds * 1000 ||
    sample.campaignCaptureSha256 !== baseline.campaignCaptureSha256 ||
    sample.productionIdentitySha256 !== baseline.productionIdentitySha256 ||
    sample.firewallIdentitySha256 !== baseline.firewallIdentitySha256 ||
    sample.dedicatedSocket !== baseline.dedicatedSocket ||
    !Number.isFinite(sample.availableMemoryBytes) ||
    sample.availableMemoryBytes < baseline.thresholds.availableMemoryBytesMin ||
    !Number.isFinite(sample.rootFreeBytes) ||
    sample.rootFreeBytes < baseline.thresholds.rootFreeBytesMin ||
    !validPsi(sample.psi) ||
    sample.psi.cpu > baseline.thresholds.cpuPsiFullAvg10Max ||
    sample.psi.memory > baseline.thresholds.memoryPsiFullAvg10Max ||
    sample.psi.io > baseline.thresholds.ioPsiFullAvg10Max ||
    !Array.isArray(sample.workers) ||
    !sample.workers.every(validWorker)
  )
    fail();
  const value = {
    accepted: true,
    campaignCaptureSha256: baseline.campaignCaptureSha256,
    firewallIdentitySha256: baseline.firewallIdentitySha256,
    productionIdentitySha256: baseline.productionIdentitySha256,
    sampledWithinSeconds: Math.ceil(sample.elapsedMilliseconds / 1000),
    workerCount: sample.workers.length,
  };
  const bytes = JSON.stringify(value);
  return { value, bytes, sha256: sha256(bytes) };
}

export async function runPrepareSupervisor(options) {
  const { baseline, collect, sleep, shouldStop } = options;
  if (
    ![collect, sleep, shouldStop].every((value) => typeof value === 'function')
  )
    throw new TypeError('prepare supervisor adapters required');
  let sampleCount = 0;
  let previousSha256 = sha256(JSON.stringify(baseline));
  while (true) {
    const checked = verifyPrepareSupervisorSample(baseline, await collect());
    sampleCount += 1;
    previousSha256 = sha256(`${previousSha256}:${checked.sha256}`);
    if (await shouldStop()) break;
    await sleep(baseline.sampleSeconds * 1000);
  }
  if (sampleCount < 2) fail();
  const value = {
    accepted: true,
    campaignCaptureSha256: baseline.campaignCaptureSha256,
    lastSampleSha256: previousSha256,
    sampleCount,
    schemaVersion: 1,
  };
  const bytes = JSON.stringify(value);
  return { value, bytes, sha256: sha256(bytes) };
}

if (import.meta.filename === process.argv[1]) {
  const [command, baselinePath, samplePath] = process.argv.slice(2);
  if (command !== 'check') throw new Error('unsupported supervisor command');
  Promise.all([readFile(baselinePath, 'utf8'), readFile(samplePath, 'utf8')])
    .then(([baseline, sample]) =>
      verifyPrepareSupervisorSample(JSON.parse(baseline), JSON.parse(sample))
    )
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
