import { Buffer } from 'node:buffer';

export const MAX_BATCH_ENTRIES = 60;

const HASH = /^[0-9a-f]{64}$/;
const MODE = /^(100644|100755)$/;
const PATH_SEGMENT = /^[A-Za-z0-9._@+-]+$/;
const STATUS = /^(A|M)$/;

function fail(message) {
  throw new Error(`review manifest: ${message}`);
}

function decode(bytes, label) {
  const value = bytes.toString('utf8');
  if (!Buffer.from(value, 'utf8').equals(bytes)) fail(`invalid UTF-8 ${label}`);
  return value;
}

function pathBytes(path) {
  return Buffer.from(path, 'utf8');
}

function validateRecord(record) {
  if (!STATUS.test(record.status)) fail('invalid status');
  if (!MODE.test(record.mode)) fail('invalid mode');
  if (!HASH.test(record.blobSha256)) fail('invalid blob hash');
  const segments = record.path?.split('/');
  if (
    !record.path ||
    record.path.startsWith('/') ||
    segments.some(
      (part) =>
        !part || part === '.' || part === '..' || !PATH_SEGMENT.test(part)
    )
  )
    fail('invalid path');
  return record;
}

function fields(bytes) {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.at(-1) !== 0)
    fail('missing terminal NUL');
  const values = [];
  let start = 0;
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] !== 0) continue;
    values.push(bytes.subarray(start, index));
    start = index + 1;
  }
  if (values.length % 4) fail('incomplete four-field record');
  return values;
}

function sorted(records) {
  return [...records].sort((left, right) =>
    Buffer.compare(pathBytes(left.path), pathBytes(right.path))
  );
}

function assertUnique(records) {
  const paths = new Set();
  for (const { path } of records) {
    if (paths.has(path)) fail('duplicate path');
    paths.add(path);
  }
}

function basename(path) {
  return path.slice(path.lastIndexOf('/') + 1);
}

function matchesAny(name, patterns) {
  return patterns.some((pattern) => pattern.test(name));
}

const DOMAIN_PROFILE = [
  {
    name: 'control-plane-image',
    matches: (path) =>
      path.startsWith('.github/') ||
      matchesAny(basename(path), [
        /^attestation-/,
        /^container-attest/,
        /^cwv-runner-authority-/,
        /^cwv-runner-stable-attestation-/,
        /^identity-contract/,
        /^baci-cwv-/,
        /^controller-contract/,
        /^cwv-measurement.*\.slice$/,
        /^docker-runtime-isolation/,
        /^entrypoint(?:\.|-)/,
        /^Dockerfile$/,
        /^containerd\.toml$/,
        /^daemon\.json$/,
        /^ogabassey-known-hosts$/,
      ]),
  },
  {
    name: 'campaign-host-measurement',
    matches: (path) =>
      matchesAny(basename(path), [
        /^campaign-/,
        /^host-/,
        /^job-start-/,
        /^measurement-/,
        /^normal-release/,
        /^retire-ollama/,
      ]),
  },
  {
    name: 'exact-run-source-policy',
    matches: (path) =>
      matchesAny(basename(path), [
        /^exact-run-/,
        /^image-/,
        /^rootfs-source-membership/,
        /^source-archive/,
        /^source-manifest/,
        /^seal-source/,
        /^policy\./,
      ]),
  },
  {
    name: 'installer',
    matches: (path) => /^install(?:\.|-)/.test(basename(path)),
  },
  {
    name: 'owner-transport-registration-controller',
    matches: (path) =>
      matchesAny(basename(path), [
        /^owner-api-/,
        /^owner-dispatch/,
        /^registration-authority-parent/,
        /^registration-cleanup/,
        /^registration-command/,
        /^registration-controller/,
        /^registration-post-egress/,
        /^registration-retry-block/,
      ]),
  },
  {
    name: 'registration-root-network-terminal',
    matches: (path) =>
      matchesAny(basename(path), [
        /^registration-network-/,
        /^registration-root-/,
        /^registration-terminal/,
        /^registration-token-/,
      ]),
  },
  {
    name: 'runtime-and-review-contracts',
    matches: (path) =>
      matchesAny(basename(path), [
        /^root-registration/,
        /^root-runtime/,
        /^runner-/,
        /^runtime-probe/,
        /^task9-/,
        /^verify-owner/,
        /^vps-ssh/,
        /^review-manifest-/,
      ]),
  },
];

function domainFor(path) {
  const matches = DOMAIN_PROFILE.filter((domain) => domain.matches(path));
  if (!matches.length) fail(`path does not match an H0 review domain: ${path}`);
  if (matches.length > 1)
    fail(`path matches multiple H0 review domains: ${path}`);
  return matches[0];
}

function canonicalRecords(bytes, label) {
  const records = parseReviewManifest(bytes);
  const canonical = serializeReviewManifest(sorted(records));
  if (!bytes.equals(canonical)) fail(`${label} is not canonical`);
  return records;
}

export function parseReviewManifest(bytes) {
  const values = fields(bytes);
  const records = [];
  for (let index = 0; index < values.length; index += 4) {
    records.push(
      validateRecord({
        status: decode(values[index], 'status'),
        mode: decode(values[index + 1], 'mode'),
        blobSha256: decode(values[index + 2], 'blob hash'),
        path: decode(values[index + 3], 'path'),
      })
    );
  }
  if (!records.length) fail('empty manifest');
  assertUnique(records);
  return records;
}

export function serializeReviewManifest(records) {
  if (!Array.isArray(records) || !records.length) fail('empty manifest');
  const checked = records.map((record) => validateRecord({ ...record }));
  assertUnique(checked);
  return Buffer.concat(
    checked.flatMap(({ status, mode, blobSha256, path }) => [
      Buffer.from(status),
      Buffer.from([0]),
      Buffer.from(mode),
      Buffer.from([0]),
      Buffer.from(blobSha256),
      Buffer.from([0]),
      pathBytes(path),
      Buffer.from([0]),
    ])
  );
}

export function canonicalizeReviewManifest(bytes) {
  return serializeReviewManifest(sorted(parseReviewManifest(bytes)));
}

export function verifyReviewManifestBatches(canonical, batches) {
  const expected = canonicalRecords(canonical, 'manifest');
  if (!Array.isArray(batches) || !batches.length) fail('empty batches');
  const records = batches.flatMap(({ bytes }, index) => {
    const entries = canonicalRecords(bytes, `batch ${index + 1}`);
    if (entries.length > MAX_BATCH_ENTRIES)
      fail(`batch ${index + 1} exceeds ${MAX_BATCH_ENTRIES} records`);
    return entries;
  });
  assertUnique(records);
  const union = serializeReviewManifest(sorted(records));
  if (!union.equals(canonical) || records.length !== expected.length)
    fail('coverage mismatch');
}

export function partitionReviewManifest(bytes) {
  const records = canonicalRecords(bytes, 'manifest');
  const batches = DOMAIN_PROFILE.map((domain) => {
    const entries = sorted(
      records.filter((record) => domainFor(record.path) === domain)
    );
    if (!entries.length) return null;
    if (entries.length > MAX_BATCH_ENTRIES)
      fail(`${domain.name} exceeds ${MAX_BATCH_ENTRIES} records`);
    return {
      domain: domain.name,
      bytes: serializeReviewManifest(entries),
      records: entries,
    };
  }).filter(Boolean);

  verifyReviewManifestBatches(bytes, batches);
  return { batches, canonical: bytes, recordCount: records.length };
}
