import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const helper = fileURLToPath(
  new URL('verify-node-bootstrap.sh', import.meta.url)
);
const sha = (path) =>
  execFileSync('shasum', ['-a', '256', path], { encoding: 'utf8' }).split(
    ' '
  )[0];

function renderedHelper(dir) {
  const hash = join(dir, 'sha256sum');
  const chmod = join(dir, 'chmod');
  const gpgv = join(dir, 'gpgv');
  const move = join(dir, 'mv');
  writeFileSync(hash, '#!/bin/sh\n/usr/bin/shasum -a 256 "$1"\n');
  writeFileSync(chmod, '#!/bin/sh\n/bin/chmod "$@"\n');
  writeFileSync(gpgv, '#!/bin/sh\nexit 0\n');
  writeFileSync(move, '#!/bin/sh\n/bin/mv "$@"\n');
  chmodSync(hash, 0o700);
  chmodSync(chmod, 0o700);
  chmodSync(gpgv, 0o700);
  chmodSync(move, 0o700);
  const rendered = join(dir, 'verify-node.sh');
  writeFileSync(
    rendered,
    readFileSync(helper, 'utf8')
      .replaceAll('/usr/bin/sha256sum', hash)
      .replaceAll('/usr/bin/chmod', chmod)
      .replaceAll('/usr/bin/gpgv', gpgv)
      .replaceAll('/usr/bin/mv', move)
  );
  return { gpgv, move, rendered };
}

test('bootstrap authorization binds signed checksum inputs and archive', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cwv-node-'));
  const archive = join(dir, 'node.tar.xz');
  const sums = join(dir, 'SHASUMS256.txt');
  const signature = join(dir, 'SHASUMS256.txt.sig');
  const keyring = join(dir, 'keys.gpg');
  const baseReceipt = join(dir, 'base-tools.json');
  const receipt = join(dir, 'receipt.json');
  writeFileSync(archive, 'node');
  writeFileSync(sums, `${sha(archive)}  node.tar.xz\n`);
  writeFileSync(signature, 'sig');
  writeFileSync(keyring, 'keys');
  writeFileSync(baseReceipt, '{"schemaVersion":1}');
  const { rendered } = renderedHelper(dir);
  execFileSync('/bin/bash', [
    rendered,
    archive,
    sums,
    signature,
    keyring,
    sha(archive),
    sha(sums),
    sha(signature),
    sha(keyring),
    sha(baseReceipt),
    baseReceipt,
    receipt,
  ]);
  const parsed = JSON.parse(readFileSync(receipt, 'utf8'));
  assert.equal(parsed.archiveBasename, 'node.tar.xz');
  assert.equal(parsed.archiveSha256, sha(archive));
  assert.equal(parsed.baseToolReceiptSha256, sha(baseReceipt));
  assert.equal(parsed.schemaVersion, 1);
});

test('post-extraction augmentation binds Node bytes to the authorized receipt atomically', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cwv-node-augment-'));
  const archive = join(dir, 'node.tar.xz');
  const sums = join(dir, 'SHASUMS256.txt');
  const signature = join(dir, 'SHASUMS256.txt.sig');
  const keyring = join(dir, 'keys.gpg');
  const baseReceipt = join(dir, 'base-tools.json');
  const bootstrapReceipt = join(dir, 'bootstrap.json');
  const nodeExecutable = join(dir, 'node');
  const receipt = join(dir, 'receipt.json');
  writeFileSync(archive, 'node archive');
  writeFileSync(sums, `${sha(archive)}  node.tar.xz\n`);
  writeFileSync(signature, 'sig');
  writeFileSync(keyring, 'keys');
  writeFileSync(baseReceipt, '{"schemaVersion":1}');
  writeFileSync(nodeExecutable, 'verified extracted node');
  chmodSync(nodeExecutable, 0o555);
  const { rendered } = renderedHelper(dir);
  const bootstrapSha = execFileSync('/bin/bash', [
    rendered,
    archive,
    sums,
    signature,
    keyring,
    sha(archive),
    sha(sums),
    sha(signature),
    sha(keyring),
    sha(baseReceipt),
    baseReceipt,
    bootstrapReceipt,
  ]).toString();
  const noncanonical = join(dir, 'noncanonical.json');
  const rejected = join(dir, 'rejected.json');
  writeFileSync(noncanonical, `${readFileSync(bootstrapReceipt, 'utf8')}\n`);
  assert.throws(() =>
    execFileSync('/bin/bash', [
      rendered,
      'augment',
      noncanonical,
      sha(noncanonical),
      baseReceipt,
      sha(baseReceipt),
      nodeExecutable,
      rejected,
    ])
  );
  assert.equal(existsSync(rejected), false);
  execFileSync('/bin/bash', [
    rendered,
    'augment',
    bootstrapReceipt,
    bootstrapSha,
    baseReceipt,
    sha(baseReceipt),
    nodeExecutable,
    receipt,
  ]);
  const parsed = JSON.parse(readFileSync(receipt, 'utf8'));
  assert.equal(parsed.executableSha256, sha(nodeExecutable));
  assert.equal(parsed.baseToolReceiptSha256, sha(baseReceipt));
  assert.equal(sha(bootstrapReceipt), bootstrapSha);
  assert.equal(existsSync(`${receipt}.tmp`), false);
});

test('post-extraction augmentation refuses a non-executable Node payload', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cwv-node-non-executable-'));
  const bootstrap = join(dir, 'bootstrap.json');
  const baseReceipt = join(dir, 'base-tools.json');
  const node = join(dir, 'node');
  const receipt = join(dir, 'receipt.json');
  writeFileSync(baseReceipt, '{"schemaVersion":1}');
  writeFileSync(node, 'not executable');
  writeFileSync(
    bootstrap,
    `{"archiveBasename":"node.tar.xz","archiveSha256":"${'a'.repeat(64)}","baseToolReceiptSha256":"${sha(baseReceipt)}","checksumsSha256":"${'b'.repeat(64)}","keyringSha256":"${'c'.repeat(64)}","schemaVersion":1,"signatureSha256":"${'d'.repeat(64)}"}`
  );
  const { rendered } = renderedHelper(dir);
  assert.throws(() =>
    execFileSync('/bin/bash', [
      rendered,
      'augment',
      bootstrap,
      sha(bootstrap),
      baseReceipt,
      sha(baseReceipt),
      node,
      receipt,
    ])
  );
  assert.equal(existsSync(receipt), false);
});

test('bootstrap authorization refuses a substituted base receipt', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cwv-node-base-'));
  const paths = [
    'node.tar.xz',
    'SHASUMS256.txt',
    'SHASUMS256.txt.sig',
    'keys.gpg',
  ];
  for (const path of paths) writeFileSync(join(dir, path), path);
  const archive = join(dir, paths[0]);
  const sums = join(dir, paths[1]);
  writeFileSync(sums, `${sha(archive)}  node.tar.xz\n`);
  const baseTarget = join(dir, 'base-target.json');
  const baseReceipt = join(dir, 'base.json');
  writeFileSync(baseTarget, '{}');
  symlinkSync(baseTarget, baseReceipt);
  const { rendered } = renderedHelper(dir);
  const args = [
    archive,
    sums,
    join(dir, paths[2]),
    join(dir, paths[3]),
    sha(archive),
    sha(sums),
    sha(join(dir, paths[2])),
    sha(join(dir, paths[3])),
    sha(baseReceipt),
    baseReceipt,
    join(dir, 'receipt.json'),
  ];
  assert.throws(() => execFileSync('/bin/bash', [rendered, ...args]));
});

test('bootstrap authorization rejects mismatched receipt and verification tool digests', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cwv-node-negative-'));
  const archive = join(dir, 'node.tar.xz');
  const sums = join(dir, 'SHASUMS256.txt');
  const signature = join(dir, 'SHASUMS256.txt.sig');
  const keyring = join(dir, 'keys.gpg');
  const baseReceipt = join(dir, 'base-tools.json');
  writeFileSync(archive, 'node');
  writeFileSync(sums, `${sha(archive)}  node.tar.xz\n`);
  writeFileSync(signature, 'sig');
  writeFileSync(keyring, 'keys');
  writeFileSync(baseReceipt, '{}');
  const { gpgv, move, rendered } = renderedHelper(dir);
  const args = [
    archive,
    sums,
    signature,
    keyring,
    sha(archive),
    sha(sums),
    sha(signature),
    sha(keyring),
    sha(baseReceipt),
    baseReceipt,
    join(dir, 'receipt.json'),
  ];
  writeFileSync(gpgv, '#!/bin/sh\nexit 1\n');
  assert.throws(() => execFileSync('/bin/bash', [rendered, ...args]));
  writeFileSync(gpgv, '#!/bin/sh\nexit 0\n');

  const moveSource = join(dir, 'move-source');
  writeFileSync(move, `#!/bin/sh\nprintf '%s' "$1" >"${moveSource}"\nexit 1\n`);
  assert.throws(() => execFileSync('/bin/bash', [rendered, ...args]));
  assert.equal(existsSync(args.at(-1)), false);
  assert.equal(readFileSync(readFileSync(moveSource, 'utf8'), 'utf8'), '');
  writeFileSync(move, '#!/bin/sh\nexit 0\n');
  assert.throws(() =>
    execFileSync('/bin/bash', [
      rendered,
      ...args.map((value, index) => (index === 4 ? '0'.repeat(64) : value)),
    ])
  );
  assert.throws(() =>
    execFileSync('/bin/bash', [
      rendered,
      ...args.map((value, index) => (index === 8 ? '0'.repeat(64) : value)),
    ])
  );
});

test('bootstrap authorization refuses a receipt changed before publication', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cwv-node-prepublish-'));
  const archive = join(dir, 'node.tar.xz');
  const sums = join(dir, 'SHASUMS256.txt');
  const signature = join(dir, 'SHASUMS256.txt.sig');
  const keyring = join(dir, 'keys.gpg');
  const baseReceipt = join(dir, 'base-tools.json');
  const receipt = join(dir, 'receipt.json');
  const marker = join(dir, 'temporary-digested');
  writeFileSync(archive, 'node');
  writeFileSync(sums, `${sha(archive)}  node.tar.xz\n`);
  writeFileSync(signature, 'sig');
  writeFileSync(keyring, 'keys');
  writeFileSync(baseReceipt, '{}');
  const { rendered } = renderedHelper(dir);
  const hash = join(dir, 'sha256sum');
  writeFileSync(
    hash,
    `#!/bin/sh\nif case "$1" in *receipt.json.tmp.*) true;; *) false;; esac; then\n  if [ -e "${marker}" ]; then printf tampered >"$1"; else : >"${marker}"; fi\nfi\n/usr/bin/shasum -a 256 "$1"\n`
  );
  assert.throws(() =>
    execFileSync('/bin/bash', [
      rendered,
      archive,
      sums,
      signature,
      keyring,
      sha(archive),
      sha(sums),
      sha(signature),
      sha(keyring),
      sha(baseReceipt),
      baseReceipt,
      receipt,
    ])
  );
  assert.equal(existsSync(receipt), false);
});
