import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import {
  canonicalJson,
  FAILURE_KEYS,
  LOCAL_ATTESTATION_DIGEST_KEYS,
  RESOURCE_KEYS,
} from './cwv-runner-authority-core.mjs';
import { readStableAttestation } from './cwv-runner-stable-attestation-builder.mjs';

const ROOT = '/host-evidence/stable-attestation';
const sha = 'a'.repeat(64);
const digest = (value) => createHash('sha256').update(value).digest('hex');
const files = Object.freeze({
  digests: 'digests.json',
  failureMatrix: 'failure-matrix.json',
  resources: 'resources.json',
  runner: 'runner.json',
  worker: 'worker.json',
});

class EvidenceFs {
  constructor() {
    this.next = 1;
    this.files = new Map();
    this.directories = new Map([
      [ROOT, this.entry(Buffer.alloc(0), 0o550, 0, 0)],
    ]);
  }
  entry(bytes, mode, uid, gid) {
    return {
      bytes: Buffer.from(bytes),
      dev: 1,
      gid,
      ino: this.next++,
      mode,
      uid,
    };
  }
  stat(value, file) {
    return {
      dev: value.dev,
      gid: value.gid,
      ino: value.ino,
      isDirectory: () => !file,
      isFile: () => file,
      isSymbolicLink: () => value.symlink === true,
      mode: value.mode,
      size: file ? value.bytes.length : 0,
      uid: value.uid,
    };
  }
  add(name, bytes, uid = 0) {
    this.files.set(name, this.entry(bytes, 0o440, uid, 0));
  }
  async lstat(path) {
    const file = this.files.get(path);
    const value = file ?? this.directories.get(path);
    if (!value) throw new Error(`missing ${path}`);
    return this.stat(value, Boolean(file));
  }
  async open(path) {
    const file = this.files.get(path);
    const value = file ?? this.directories.get(path);
    if (!value) throw new Error(`missing ${path}`);
    return {
      close: async () => {},
      readFile: async () => Buffer.from(value.bytes),
      stat: async () => this.stat(value, Boolean(file)),
    };
  }
}

const join = (name) => `${ROOT}/${name}`;
const runner = { generation: 1, id: 7, name: 'baci-cwv-measurement-01' };
const sources = () => {
  const digests = Object.fromEntries(
    LOCAL_ATTESTATION_DIGEST_KEYS.map((key) => [key, sha])
  );
  digests.runnerIdentitySha256 = digest(canonicalJson(runner));
  return {
    digests,
    failureMatrix: Object.fromEntries(FAILURE_KEYS.map((key) => [key, true])),
    resources: Object.fromEntries(RESOURCE_KEYS.map((key) => [key, 1])),
    runner,
    worker: { count: 1 },
  };
};

function fixture({ uid = 0 } = {}) {
  const fs = new EvidenceFs();
  const values = sources();
  const metadata = {};
  for (const [name, file] of Object.entries(files)) {
    const bytes = canonicalJson(values[name]);
    metadata[name] = { file, sha256: digest(bytes) };
    fs.add(join(file), bytes, uid);
    fs.add(join(`${file}.sha256`), `${digest(bytes)}\n`, uid);
  }
  const receipt = {
    accepted: Object.fromEntries(
      [
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
      ].map((key) => [key, true])
    ),
    generation: 1,
    kind: 'task8-stable-attestation',
    policyFileSha256: sha,
    runner,
    schemaVersion: 1,
    sources: metadata,
  };
  const receiptBytes = canonicalJson(receipt);
  fs.add(join('receipt.json'), receiptBytes, uid);
  fs.add(join('receipt.json.sha256'), `${digest(receiptBytes)}\n`, uid);
  return fs;
}

function writeSealed(fs, file, value) {
  const bytes = canonicalJson(value);
  fs.files.get(join(file)).bytes = Buffer.from(bytes);
  fs.files.get(join(`${file}.sha256`)).bytes = Buffer.from(`${digest(bytes)}\n`);
  return bytes;
}

function mutateAndResealSource(fs, name, mutate) {
  const file = files[name];
  const source = JSON.parse(fs.files.get(join(file)).bytes.toString('utf8'));
  const bytes = writeSealed(fs, file, mutate(source));
  const receipt = JSON.parse(
    fs.files.get(join('receipt.json')).bytes.toString('utf8')
  );
  receipt.sources[name].sha256 = digest(bytes);
  writeSealed(fs, 'receipt.json', receipt);
}

function mutateAndResealReceipt(fs, mutate) {
  const receipt = JSON.parse(
    fs.files.get(join('receipt.json')).bytes.toString('utf8')
  );
  writeSealed(fs, 'receipt.json', mutate(receipt));
}

test('builds the stable projection only from canonical root-owned named receipts and sidecars', async () => {
  const value = await readStableAttestation({
    fs: fixture(),
    policyFileSha256: sha,
    runner,
  });
  assert.equal(value.runnerId, 7);
  assert.equal(value.runnerGeneration, 1);
  assert.equal(value.workerCount, 1);
  assert.equal(
    value.digests.runnerIdentitySha256,
    digest(canonicalJson(runner))
  );
});

test('rejects a caller-fabricated self-hashed bundle without the root authority boundary', async () => {
  await assert.rejects(
    readStableAttestation({
      fs: fixture({ uid: 10001 }),
      policyFileSha256: sha,
      runner,
    }),
    /authenticated root evidence|source receipt/
  );
});

test('accepts safe nonnegative resources after every source and receipt digest is resealed', async () => {
  const fs = fixture();
  mutateAndResealSource(fs, 'resources', (resources) => ({
    ...resources,
    [RESOURCE_KEYS[0]]: 999,
  }));
  const value = await readStableAttestation({ fs, policyFileSha256: sha, runner });
  assert.equal(value.resources[RESOURCE_KEYS[0]], 999);
});

test('rejects a stale source sidecar independently', async () => {
  const fs = fixture();
  fs.files.get(join('resources.json')).bytes = Buffer.from(
    canonicalJson(Object.fromEntries(RESOURCE_KEYS.map((key) => [key, 999])))
  );
  await assert.rejects(
    readStableAttestation({ fs, policyFileSha256: sha, runner }),
    /resources source sidecar/
  );
});

test('rejects rehashed source metadata drift after checksum validation', async () => {
  const fs = fixture();
  mutateAndResealSource(fs, 'resources', (resources) => ({
    ...resources,
    [RESOURCE_KEYS[0]]: 999,
  }));
  mutateAndResealReceipt(fs, (receipt) => ({
    ...receipt,
    sources: {
      ...receipt.sources,
      resources: { ...receipt.sources.resources, file: 'wrong.json' },
    },
  }));
  await assert.rejects(
    readStableAttestation({ fs, policyFileSha256: sha, runner }),
    /source metadata/
  );
});

test('rejects rehashed source policy drift after checksum validation', async () => {
  const fs = fixture();
  mutateAndResealSource(fs, 'digests', (digests) => ({
    ...digests,
    policyFileSha256: 'b'.repeat(64),
  }));
  await assert.rejects(
    readStableAttestation({ fs, policyFileSha256: sha, runner }),
    /stable evidence/
  );
});

test('rejects rehashed source runner-generation drift after checksum validation', async () => {
  const fs = fixture();
  mutateAndResealSource(fs, 'runner', (sourceRunner) => ({
    ...sourceRunner,
    generation: 2,
  }));
  await assert.rejects(
    readStableAttestation({ fs, policyFileSha256: sha, runner }),
    /runner evidence/
  );
});

test('rejects a stale receipt sidecar independently', async () => {
  const fs = fixture();
  fs.files.get(join('receipt.json.sha256')).bytes = Buffer.from(`${sha}\n`);
  await assert.rejects(
    readStableAttestation({ fs, policyFileSha256: sha, runner }),
    /source receipt sidecar/
  );
});
