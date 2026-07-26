import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { join } from 'node:path';

import {
  canonicalJson,
  FAILURE_KEYS,
  LOCAL_ATTESTATION_DIGEST_KEYS,
  RESOURCE_KEYS,
} from './cwv-runner-authority-core.mjs';

const ROOT = '/host-evidence/stable-attestation';
const SHA256 = /^[a-f0-9]{64}$/;
const SOURCE_FILES = Object.freeze({
  digests: 'digests.json',
  failureMatrix: 'failure-matrix.json',
  resources: 'resources.json',
  runner: 'runner.json',
  worker: 'worker.json',
});
const ACCEPTED_KEYS = [
  'failureMatrix',
  'hold',
  'hostAttestation',
  'image',
  'policy',
  'processMap',
  'resources',
  'restore',
  'retirement',
  'scripts',
  'service',
  'sourceManifest',
];

const fail = (label) => {
  throw new TypeError(`${label} refused`);
};
const object = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const exact = (value, keys, label) => {
  if (!object(value) || !same(Object.keys(value).sort(), [...keys].sort()))
    fail(label);
};
const digest = (value) => createHash('sha256').update(value).digest('hex');
const mode = (stat) => stat.mode & 0o777;
const identity = (stat) =>
  `${stat.dev}:${stat.ino}:${stat.uid}:${stat.gid}:${mode(stat)}:${stat.size}`;

async function rootDirectory(fs) {
  try {
    const before = await fs.lstat(ROOT);
    if (
      !before.isDirectory() ||
      before.isSymbolicLink() ||
      before.uid !== 0 ||
      before.gid !== 0 ||
      mode(before) !== 0o550
    )
      fail('authenticated root evidence');
    const handle = await fs.open(
      ROOT,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW
    );
    try {
      const opened = await handle.stat();
      const named = await fs.lstat(ROOT);
      if (
        !opened.isDirectory() ||
        opened.isSymbolicLink() ||
        identity(opened) !== identity(before) ||
        identity(named) !== identity(before)
      )
        fail('authenticated root evidence');
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (
      error instanceof TypeError &&
      error.message === 'authenticated root evidence refused'
    )
      throw error;
    fail('authenticated root evidence');
  }
}

async function rootFile(fs, name, label) {
  const path = join(ROOT, name);
  try {
    const before = await fs.lstat(path);
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.uid !== 0 ||
      before.gid !== 0 ||
      mode(before) !== 0o440 ||
      !Number.isSafeInteger(before.size) ||
      before.size < 1 ||
      before.size > 1_048_576
    )
      fail(label);
    const handle = await fs.open(
      path,
      constants.O_RDONLY | constants.O_NOFOLLOW
    );
    try {
      const opened = await handle.stat();
      const bytes = await handle.readFile();
      const after = await handle.stat();
      const named = await fs.lstat(path);
      if (
        !opened.isFile() ||
        opened.isSymbolicLink() ||
        identity(opened) !== identity(before) ||
        identity(after) !== identity(before) ||
        identity(named) !== identity(before) ||
        bytes.length !== before.size
      )
        fail(label);
      return bytes;
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (error instanceof TypeError && error.message === `${label} refused`)
      throw error;
    fail(label);
  }
}

async function sealedJson(fs, file, label) {
  const bytes = await rootFile(fs, file, label);
  const sidecar = await rootFile(fs, `${file}.sha256`, `${label} sidecar`);
  if (sidecar.toString('utf8') !== `${digest(bytes)}\n`)
    fail(`${label} sidecar`);
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail(label);
  }
  if (bytes.toString('utf8') !== canonicalJson(value)) fail(label);
  return { bytes, value };
}

function assertRunner(value, expected) {
  exact(value, ['generation', 'id', 'name'], 'runner evidence');
  if (
    value.generation !== 1 ||
    !Number.isSafeInteger(value.id) ||
    value.id < 1 ||
    value.name !== 'baci-cwv-measurement-01' ||
    !same(value, expected)
  )
    fail('runner evidence');
}

export async function readStableAttestation({ fs, policyFileSha256, runner }) {
  if (!fs || !SHA256.test(policyFileSha256 ?? ''))
    fail('stable evidence input');
  assertRunner(runner, runner);
  await rootDirectory(fs);
  const receipt = (await sealedJson(fs, 'receipt.json', 'source receipt'))
    .value;
  exact(
    receipt,
    [
      'accepted',
      'generation',
      'kind',
      'policyFileSha256',
      'runner',
      'schemaVersion',
      'sources',
    ],
    'source receipt'
  );
  exact(receipt.accepted, ACCEPTED_KEYS, 'accepted evidence');
  exact(receipt.sources, Object.keys(SOURCE_FILES), 'source receipt');
  assertRunner(receipt.runner, runner);
  if (
    receipt.schemaVersion !== 1 ||
    receipt.kind !== 'task8-stable-attestation' ||
    receipt.generation !== 1 ||
    receipt.policyFileSha256 !== policyFileSha256 ||
    Object.values(receipt.accepted).some((value) => value !== true)
  )
    fail('source receipt');
  const sources = {};
  for (const [name, file] of Object.entries(SOURCE_FILES)) {
    exact(receipt.sources[name], ['file', 'sha256'], 'source metadata');
    const source = await sealedJson(fs, file, `${name} source`);
    if (
      receipt.sources[name].file !== file ||
      receipt.sources[name].sha256 !== digest(source.bytes)
    )
      fail('source metadata');
    sources[name] = source.value;
  }
  assertRunner(sources.runner, runner);
  exact(sources.worker, ['count'], 'worker evidence');
  exact(sources.resources, RESOURCE_KEYS, 'resource evidence');
  exact(sources.digests, LOCAL_ATTESTATION_DIGEST_KEYS, 'digest evidence');
  exact(sources.failureMatrix, FAILURE_KEYS, 'failure evidence');
  if (
    sources.worker.count !== 1 ||
    Object.values(sources.resources).some(
      (value) => !Number.isSafeInteger(value) || value < 0
    ) ||
    Object.values(sources.digests).some((value) => !SHA256.test(value)) ||
    sources.digests.policyFileSha256 !== policyFileSha256 ||
    sources.digests.runnerIdentitySha256 !== digest(canonicalJson(runner)) ||
    Object.values(sources.failureMatrix).some((value) => value !== true)
  )
    fail('stable evidence');
  return Object.freeze({
    digests: Object.freeze({ ...sources.digests }),
    failureMatrix: Object.freeze({ ...sources.failureMatrix }),
    resources: Object.freeze({ ...sources.resources }),
    runnerGeneration: runner.generation,
    runnerId: runner.id,
    workerCount: sources.worker.count,
  });
}
