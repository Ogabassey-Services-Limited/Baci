import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const helper = new URL('verify-apt-snapshot.sh', import.meta.url).pathname;
const sha = (value) => createHash('sha256').update(value).digest('hex');
function fixture({
  archiveDrift = false,
  badSignature = false,
  gpgvNonzero = false,
  keyringReceiptDrift = false,
  packageSha = undefined,
  receiptDrift = false,
  releaseDate = 'Mon, 20 Jul 2026 00:00:00 UTC',
  snapshotService = 'https://snapshot.ubuntu.com/ubuntu/@SNAPSHOTID@',
  sourcesSnapshot = '20260720T000000Z',
} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cwv-apt-provenance-'));
  const bin = join(root, 'bin');
  const lists = join(root, 'lists');
  const archives = join(root, 'archives');
  mkdirSync(bin);
  mkdirSync(lists);
  mkdirSync(archives);
  const keyring = join(root, 'ubuntu-keyring.gpg');
  writeFileSync(keyring, 'frozen-keyring');
  const deb = join(archives, 'ca-certificates_1_amd64.deb');
  writeFileSync(deb, 'verified-deb-bytes');
  const debSha = packageSha ?? sha(readFileSync(deb));
  const packagesName =
    'archive.ubuntu.com_ubuntu_dists_noble_main_binary-amd64_Packages';
  const packages = [
    'Package: ca-certificates',
    'Version: 1',
    'Architecture: amd64',
    'Filename: pool/main/c/ca-certificates/ca-certificates_1_amd64.deb',
    `SHA256: ${debSha}`,
    '',
  ].join('\n');
  const packagesPath = join(lists, packagesName);
  writeFileSync(packagesPath, packages);
  const inReleaseName = 'archive.ubuntu.com_ubuntu_dists_noble_InRelease';
  const releasePath = join(lists, inReleaseName);
  writeFileSync(
    releasePath,
    [
      badSignature ? 'BAD' : 'GOOD',
      `Date: ${releaseDate}`,
      `Snapshots: ${snapshotService}`,
      'SHA256:',
      ` ${sha(packages)} ${Buffer.byteLength(packages)} main/binary-amd64/Packages`,
      '',
    ].join('\n')
  );
  const fakeGpgv = join(bin, 'gpgv');
  writeFileSync(
    fakeGpgv,
    `#!/bin/sh\ngrep -q BAD "$3" && exit 1\n${gpgvNonzero ? 'exit 7' : 'exit 0'}\n`
  );
  chmodSync(fakeGpgv, 0o755);
  const fakeSha = join(bin, 'sha256sum');
  if (archiveDrift) {
    const state = join(root, 'archive-hash-count');
    writeFileSync(
      fakeSha,
      `#!/bin/sh\nif [ "$1" = '${deb}' ]; then n=$(cat '${state}' 2>/dev/null || printf 0); printf '%s' $((n + 1)) >'${state}'; [ "$n" -gt 0 ] && { printf '%064d  %s\\n' 0 "$1"; exit; }; fi\nexec /usr/bin/shasum -a 256 "$1"\n`
    );
  } else {
    writeFileSync(fakeSha, '#!/bin/sh\nexec /usr/bin/shasum -a 256 "$1"\n');
  }
  chmodSync(fakeSha, 0o755);
  const fakeStat = join(bin, 'stat');
  writeFileSync(
    fakeStat,
    '#!/bin/sh\n[ "$#" -eq 3 ] && [ "$1" = -Lc ] && [ "$2" = %s ] || exit 64\n/usr/bin/wc -c <"$3" | /usr/bin/tr -d "[:space:]"\n'
  );
  chmodSync(fakeStat, 0o755);
  let move = '/bin/mv';
  if (receiptDrift) {
    const fakeMv = join(bin, 'mv');
    writeFileSync(
      fakeMv,
      '#!/bin/sh\n/bin/mv "$@"\nchmod u+w "$2"\nprintf " " >>"$2"\nchmod 0444 "$2"\n'
    );
    chmodSync(fakeMv, 0o755);
    move = fakeMv;
  }
  const selections = join(root, 'selections.tsv');
  writeFileSync(
    selections,
    `${[
      'ca-certificates',
      '1',
      'amd64',
      'pool/main/c/ca-certificates/ca-certificates_1_amd64.deb',
      debSha,
      deb,
    ].join('\t')}\n`
  );
  const sources = join(root, 'baci.sources');
  writeFileSync(sources, `Snapshot: ${sourcesSnapshot}\n`);
  const baseReceipt = join(root, 'base-tools.json');
  writeFileSync(
    baseReceipt,
    JSON.stringify({
      schemaVersion: 1,
      tools: [
        {
          role: 'keyring',
          sha256: keyringReceiptDrift ? '0'.repeat(64) : sha('frozen-keyring'),
        },
      ],
    })
  );
  const rendered = join(root, 'verify-apt.sh');
  writeFileSync(
    rendered,
    readFileSync(helper, 'utf8')
      .replaceAll('/usr/bin/gpgv', fakeGpgv)
      .replaceAll('/usr/bin/sha256sum', fakeSha)
      .replaceAll('/usr/bin/stat', fakeStat)
      .replaceAll('/usr/bin/mv', move)
  );
  return {
    baseReceipt,
    bin,
    keyring,
    lists,
    packages,
    packagesPath,
    releasePath,
    receipt: join(root, 'receipt.json'),
    rendered,
    selections,
    sources,
  };
}
function run(value) {
  return spawnSync(
    '/bin/bash',
    [
      value.rendered,
      value.keyring,
      value.lists,
      value.selections,
      '20260720T000000Z',
      value.sources,
      value.baseReceipt,
      value.receipt,
    ],
    { encoding: 'utf8', env: { PATH: `${value.bin}:${process.env.PATH}` } }
  );
}
test('verifies signed snapshot indexes and emits canonical selected rows', () => {
  const value = fixture();
  const result = run(value);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(value.receipt, 'utf8').endsWith('\n'), false);
  assert.deepEqual(JSON.parse(readFileSync(value.receipt, 'utf8')), {
    baseToolReceiptSha256: sha(readFileSync(value.baseReceipt)),
    indexes: [
      {
        path: 'archive.ubuntu.com_ubuntu_dists_noble_main_binary-amd64_Packages',
        sha256: sha(value.packages),
      },
    ],
    keyringSha256: sha('frozen-keyring'),
    packages: [
      {
        architecture: 'amd64',
        filename: 'pool/main/c/ca-certificates/ca-certificates_1_amd64.deb',
        name: 'ca-certificates',
        sha256: sha('verified-deb-bytes'),
        version: '1',
      },
    ],
    releases: [
      {
        path: 'archive.ubuntu.com_ubuntu_dists_noble_InRelease',
        sha256: sha(readFileSync(value.releasePath)),
      },
    ],
    schemaVersion: 1,
    snapshotId: '20260720T000000Z',
    sourcesSha256: sha('Snapshot: 20260720T000000Z\n'),
  });
});
test('binds the snapshot id to its source request and signed service metadata', () => {
  for (const value of [
    fixture({ sourcesSnapshot: '20260721T000000Z' }),
    fixture({ snapshotService: 'https://archive.ubuntu.com/ubuntu' }),
    fixture({ releaseDate: 'Tue, 21 Jul 2026 00:00:00 UTC' }),
  ]) {
    const result = run(value);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /APT snapshot verification failed/);
  }
});
test('rejects an invalid InRelease signature before package authorization', () => {
  const result = run(fixture({ badSignature: true }));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /APT snapshot verification failed/);
});
test('fails closed when gpgv returns a nonzero status', () => {
  const result = run(fixture({ gpgvNonzero: true }));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /APT snapshot verification failed/);
});
test('binds the signing keyring digest to the frozen base-tool receipt before gpgv', () => {
  const result = run(fixture({ keyringReceiptDrift: true }));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /APT snapshot verification failed/);
});
test('rejects package archive bytes not bound by the signed Packages row', () => {
  const result = run(fixture({ packageSha: '0'.repeat(64) }));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /APT snapshot verification failed/);
});
test('rejects missing or duplicate signed package indexes', () => {
  const missing = fixture();
  unlinkSync(missing.packagesPath);
  assert.notEqual(run(missing).status, 0);
  const duplicate = fixture();
  appendFileSync(
    duplicate.releasePath,
    [
      ` ${sha(duplicate.packages)} ${Buffer.byteLength(duplicate.packages)} main/binary-amd64/Packages`,
      '',
    ].join('\n')
  );
  assert.notEqual(run(duplicate).status, 0);
});
test('rejects duplicate or identity-drifted package stanzas', () => {
  const duplicate = fixture();
  appendFileSync(duplicate.packagesPath, `\n${duplicate.packages}`);
  const duplicatedPackages = readFileSync(duplicate.packagesPath);
  writeFileSync(
    duplicate.releasePath,
    `GOOD\nSHA256:\n ${sha(duplicatedPackages)} ${duplicatedPackages.length} main/binary-amd64/Packages\n`
  );
  assert.notEqual(run(duplicate).status, 0);
  for (const field of ['1\tarm64', '2\tamd64']) {
    const drift = fixture();
    const values = readFileSync(drift.selections, 'utf8').trim().split('\t');
    const [version, architecture] = field.split('\t');
    values[1] = version;
    values[2] = architecture;
    writeFileSync(drift.selections, `${values.join('\t')}\n`);
    assert.notEqual(run(drift).status, 0);
  }
});
test('Docker binds the exact APT verifier arguments before installation', () => {
  const dockerfile = readFileSync(
    new URL('Dockerfile', import.meta.url),
    'utf8'
  );
  assert.match(
    dockerfile,
    /verify-base-tools\.sh "\$UBUNTU_IMAGE" \/opt\/baci-cwv\/base-tools\.tsv \/tmp\/base-tools-before-apt\.json >\/dev\/null; \\\n\s+ubuntu_receipt_sha=\$\(\/opt\/baci-cwv\/verify-apt-snapshot\.sh "\$keyring" \/var\/lib\/apt\/lists \\\n\s+"\$apt_work\/archives" "\$UBUNTU_SNAPSHOT" \/etc\/apt\/sources\.list\.d\/baci\.sources \\\n\s+\/tmp\/base-tools-before-apt\.json \\\n\s+\/opt\/baci-cwv\/provenance\/ubuntu\.json\);/
  );
  assert.match(
    dockerfile,
    /verify-base-tools\.sh "\$UBUNTU_IMAGE" \/opt\/baci-cwv\/base-tools\.tsv \/tmp\/base-tools-before-dpkg\.json >\/dev\/null; \\\n\s+dpkg -i/
  );
  assert.match(
    dockerfile,
    /base_tools_receipt_sha=\$\(\/opt\/baci-cwv\/verify-base-tools\.sh "\$UBUNTU_IMAGE" \/opt\/baci-cwv\/base-tools\.tsv "\$work\/base-tools-before-node\.json"\); \\\n\s+node_receipt_sha=\$\(\/opt\/baci-cwv\/verify-node-bootstrap\.sh "\$work\/\$node_name" "\$work\/node-checksums" \\\n\s+"\$work\/node-signature" "\$work\/node-keyring" "\$NODE_SHA256" \\\n\s+"\$\(jq -er '\.node\.checksumsSha256' "\$provenance"\)" \\\n\s+"\$\(jq -er '\.node\.signatureSha256' "\$provenance"\)" \\\n\s+"\$\(jq -er '\.node\.keyringSha256' "\$provenance"\)" \\\n\s+"\$base_tools_receipt_sha" \\\n\s+"\$work\/base-tools-before-node\.json" "\$work\/node-receipt\.json"\);/
  );
  assert.doesNotMatch(
    dockerfile,
    /dpkg -i[^\n]+\|\| apt-get|apt-get[^\n]+-f install/
  );
  assert.match(
    dockerfile,
    /value=\$\(jq -cS[^\n]+\); \\\n\s+printf '%s' "\$value"/
  );
  assert.match(dockerfile, /ubuntuReceiptSha256:\$ubuntuReceiptSha256/);
});
test('rejects archive or published receipt drift at the terminal boundary', () => {
  for (const value of [
    fixture({ archiveDrift: true }),
    fixture({ receiptDrift: true }),
  ]) {
    const result = run(value);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /APT snapshot verification failed/);
  }
});
