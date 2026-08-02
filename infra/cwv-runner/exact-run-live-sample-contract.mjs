import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const SHA = /^[a-f0-9]{64}$/;
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
const fail = (message) => {
  throw new Error(message);
};
export const canonicalLiveSampleJson = (value) =>
  Array.isArray(value)
    ? `[${value.map(canonicalLiveSampleJson).join(',')}]`
    : value && typeof value === 'object'
      ? `{${Object.keys(value)
          .sort()
          .map(
            (key) =>
              `${JSON.stringify(key)}:${canonicalLiveSampleJson(value[key])}`
          )
          .join(',')}}`
      : JSON.stringify(value);
const same = (left, right) =>
  canonicalLiveSampleJson(left) === canonicalLiveSampleJson(right);
const exact = (value, keys, name) => {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !same(Object.keys(value).sort(), [...keys].sort())
  )
    fail(`${name} keys are invalid`);
};
const digest = (value) => createHash('sha256').update(value).digest('hex');
const projection = (value) =>
  Object.fromEntries(BINDING_KEYS.map((key) => [key, value[key]]));

function parseCanonical(bytes) {
  if (!Buffer.isBuffer(bytes)) fail('live sample bytes are invalid');
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail('live sample JSON is invalid');
  }
  if (bytes.toString('utf8') !== canonicalLiveSampleJson(value))
    fail('live sample is not canonical');
  return value;
}

function validateExpected(expected) {
  exact(
    expected,
    ['binding', 'classifierHandle', 'schemaVersion'],
    'expected live sample'
  );
  exact(expected.binding, BINDING_KEYS, 'expected live sample binding');
  if (
    expected.schemaVersion !== 1 ||
    !Number.isSafeInteger(expected.classifierHandle) ||
    expected.classifierHandle < 1 ||
    ![
      expected.binding.accountingIdentitySha256,
      expected.binding.captureSha256,
      expected.binding.policySha256,
      expected.binding.runnerContainerId,
    ].every((value) => SHA.test(value))
  )
    fail('expected live sample is invalid');
}

function validateLiveIdentity(host, expected) {
  const identity = host.liveIdentity;
  exact(
    identity,
    ['classifier', 'container', 'idleContainerSha256', 'nftSha256'],
    'live identity'
  );
  exact(identity.classifier, ['handle', 'sha256'], 'classifier identity');
  exact(
    identity.container,
    [
      'cgroup',
      'expectedImage',
      'expectedNetwork',
      'id',
      'image',
      'networkMode',
      'pid',
      'running',
    ],
    'container identity'
  );
  if (
    identity.classifier.handle !== expected.classifierHandle ||
    !SHA.test(identity.classifier.sha256) ||
    !SHA.test(identity.idleContainerSha256) ||
    !SHA.test(identity.nftSha256) ||
    identity.container.id !== expected.binding.runnerContainerId ||
    identity.container.running !== true ||
    identity.container.image !== identity.container.expectedImage ||
    identity.container.networkMode !== 'baci-cwv-net' ||
    identity.container.expectedNetwork !== 'baci-cwv-net'
  )
    fail('live classifier or container binding drift');
}

export function validateBoundLiveSample({
  expected,
  nowEpochSeconds,
  sampleBytes,
}) {
  validateExpected(expected);
  if (!Number.isSafeInteger(nowEpochSeconds) || nowEpochSeconds < 0)
    fail('root time is invalid');
  const sample = parseCanonical(sampleBytes);
  exact(
    sample,
    ['campaignId', 'capturedAt', 'collectors', 'host', 'idle', 'schemaVersion'],
    'live sample'
  );
  exact(sample.collectors, ['host', 'idle'], 'live sample collectors');
  for (const name of ['host', 'idle']) {
    exact(sample.collectors[name], ['ok', 'sha256'], `${name} collector`);
    if (
      sample.collectors[name].ok !== true ||
      sample.collectors[name].sha256 !==
        digest(canonicalLiveSampleJson(sample[name]))
    )
      fail('live sample collector digest drift');
  }
  exact(
    sample.host,
    [...BINDING_KEYS, 'liveIdentity', 'schemaVersion'],
    'live host'
  );
  exact(
    sample.idle,
    ['accepted', 'binding', 'campaignId', 'mode'],
    'idle collector'
  );
  exact(sample.idle.binding, BINDING_KEYS, 'idle binding');
  const captured = Date.parse(sample.capturedAt) / 1000;
  if (
    sample.schemaVersion !== 1 ||
    sample.host.schemaVersion !== 1 ||
    sample.campaignId !== expected.binding.campaignId ||
    sample.host.campaignId !== sample.campaignId ||
    sample.idle.campaignId !== sample.campaignId ||
    sample.idle.mode !== 'live' ||
    sample.idle.accepted !== true ||
    !same(projection(sample.host), expected.binding) ||
    !same(sample.idle.binding, expected.binding) ||
    !Number.isFinite(captured) ||
    new Date(captured * 1000).toISOString() !== sample.capturedAt ||
    captured > nowEpochSeconds ||
    nowEpochSeconds - captured > 15
  )
    fail('live sample binding or freshness drift');
  validateLiveIdentity(sample.host, expected);
  return Object.freeze({ accepted: true, capturedAt: sample.capturedAt });
}

async function main() {
  const [samplePath, expectedPath, now] = process.argv.slice(2);
  if (!now || process.argv.length !== 5 || !/^(?:0|[1-9][0-9]*)$/.test(now))
    fail(
      'usage: exact-run-live-sample-contract.mjs <sample> <expected> <epoch-seconds>'
    );
  const result = validateBoundLiveSample({
    expected: JSON.parse(await readFile(expectedPath, 'utf8')),
    nowEpochSeconds: Number(now),
    sampleBytes: await readFile(samplePath),
  });
  process.stdout.write(canonicalLiveSampleJson(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
