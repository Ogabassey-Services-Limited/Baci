import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  EVIDENCE_DIRECTORY_MODE,
  EVIDENCE_GID,
  EVIDENCE_MODE,
  EVIDENCE_UID,
  publishSourceEvidence,
  readSourceEvidence,
} from './attestation-evidence-store.mjs';
import { canonicalJson } from './host-attestation.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function envelope() {
  const canonical = canonicalJson({
    authorityMode: 'personal-public-exact-run',
    namespace: 'baci_cwv_measurement',
    policyFileSha256: 'a'.repeat(64),
    schemaVersion: 1,
  });
  return {
    canonical,
    owner: { gid: EVIDENCE_GID, mode: '0640', uid: EVIDENCE_UID },
    schemaVersion: 1,
    sha256Receipt: `${sha256(canonical)}\n`,
    source: 'policy',
  };
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'cwv-attestation-'));
  const evidence = join(root, 'evidence');
  await mkdir(evidence, { mode: EVIDENCE_DIRECTORY_MODE });
  return { root, evidence };
}

function evidenceOptions(evidence) {
  return {
    gid: process.getgid(),
    relativePath: (_directoryHandle, name) => join(evidence, name),
    uid: process.getuid(),
  };
}

test('publishes and reads canonical evidence using actual file metadata', async () => {
  const { evidence } = await fixture();
  const options = evidenceOptions(evidence);

  const receipt = await publishSourceEvidence(
    evidence,
    'policy',
    envelope(),
    options
  );
  const restored = await readSourceEvidence(evidence, 'policy', options);

  assert.deepEqual(restored, envelope());
  assert.equal(receipt.sha256, sha256(await readFile(receipt.path)));
  for (const name of ['policy.json', 'policy.sha256']) {
    const details = await lstat(join(evidence, name));
    assert.equal(details.mode & 0o777, EVIDENCE_MODE);
    assert.equal(details.uid, options.uid);
    assert.equal(details.gid, options.gid);
  }
});

test('refuses mode, digest, symlink, and self-asserted owner drift', async () => {
  const { evidence, root } = await fixture();
  const options = evidenceOptions(evidence);
  await publishSourceEvidence(evidence, 'policy', envelope(), options);

  await chmod(join(evidence, 'policy.json'), 0o600);
  await assert.rejects(
    readSourceEvidence(evidence, 'policy', options),
    /metadata/
  );
  await chmod(join(evidence, 'policy.json'), EVIDENCE_MODE);
  await writeFile(join(evidence, 'policy.sha256'), `${'0'.repeat(64)}\n`);
  await assert.rejects(
    readSourceEvidence(evidence, 'policy', options),
    /digest/
  );
  await unlink(join(evidence, 'policy.json'));
  await symlink(join(root, 'missing'), join(evidence, 'policy.json'));
  await assert.rejects(
    readSourceEvidence(evidence, 'policy', options),
    /metadata/
  );
  await assert.rejects(
    publishSourceEvidence(
      evidence,
      'policy',
      {
        ...envelope(),
        owner: { gid: 0, mode: '0640', uid: 0 },
      },
      options
    ),
    /root-owned evidence/
  );
});

test('requires an exact one-line receipt and refuses a symlinked prior path', async () => {
  const { evidence, root } = await fixture();
  const options = evidenceOptions(evidence);
  await publishSourceEvidence(evidence, 'policy', envelope(), options);

  await writeFile(
    join(evidence, 'policy.sha256'),
    `${sha256(await readFile(join(evidence, 'policy.json')))}\n\n`
  );
  await assert.rejects(
    readSourceEvidence(evidence, 'policy', options),
    /invalid evidence receipt/
  );

  await unlink(join(evidence, 'policy.json'));
  await symlink(join(root, 'missing'), join(evidence, 'policy.json'));
  await assert.rejects(
    publishSourceEvidence(evidence, 'policy', envelope(), options),
    /metadata/
  );

  const linkedEvidence = join(root, 'linked-evidence');
  await symlink(evidence, linkedEvidence);
  await assert.rejects(
    readSourceEvidence(linkedEvidence, 'policy', options),
    /metadata/
  );
});

test('freezes production ownership and mode constants', () => {
  assert.deepEqual(
    {
      directoryMode: EVIDENCE_DIRECTORY_MODE,
      gid: EVIDENCE_GID,
      mode: EVIDENCE_MODE,
      uid: EVIDENCE_UID,
    },
    { directoryMode: 0o750, gid: 10001, mode: 0o640, uid: 0 }
  );
});

test('pins evidence publishing to the validated directory after its pathname is replaced', async () => {
  const { evidence, root } = await fixture();
  const options = evidenceOptions(evidence);
  const parked = join(root, 'parked-evidence');
  let swapped = false;
  const swappedOptions = {
    ...options,
    onOperation: async (operation) => {
      if (operation !== 'directory-open' || swapped) return;
      await rename(evidence, parked);
      await mkdir(evidence, { mode: EVIDENCE_DIRECTORY_MODE });
      swapped = true;
    },
    relativePath: (_directoryHandle, name) => join(parked, name),
  };

  await publishSourceEvidence(evidence, 'policy', envelope(), swappedOptions);

  assert.equal(swapped, true);
  assert.deepEqual((await readdir(parked)).sort(), [
    'policy.json',
    'policy.sha256',
  ]);
  assert.deepEqual(await readdir(evidence), []);
});

test('pins evidence reads to the validated directory after its pathname is replaced', async () => {
  const { evidence, root } = await fixture();
  const options = evidenceOptions(evidence);
  await publishSourceEvidence(evidence, 'policy', envelope(), options);
  const parked = join(root, 'parked-evidence');
  let swapped = false;
  const restored = await readSourceEvidence(evidence, 'policy', {
    ...options,
    onOperation: async (operation) => {
      if (operation !== 'directory-open' || swapped) return;
      await rename(evidence, parked);
      await mkdir(evidence, { mode: EVIDENCE_DIRECTORY_MODE });
      swapped = true;
    },
    relativePath: (_directoryHandle, name) => join(parked, name),
  });

  assert.equal(swapped, true);
  assert.deepEqual(restored, envelope());
});
