import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  beginBootstrap,
  completeBootstrap,
  persistBootstrapCapture,
  persistBootstrapReceipt,
  readBootstrapState,
} from './install-bootstrap.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const files = {
  '/etc/baci-cwv/daemon.json': {
    sha256: sha256('daemon'),
    mode: '0644',
    owner: 'root:root',
  },
};
const disabledUnits = {
  'baci-cwv-docker.service': 'loaded\ninactive\ndisabled\n',
};
const capture = (transactionId) =>
  beginBootstrap({
    transactionId,
    sourceSha: 'a'.repeat(40),
    sourceManifestSha256: 'b'.repeat(64),
    policyFileSha256: 'c'.repeat(64),
    prior: { '/etc/baci-cwv/daemon.json': { absent: true } },
    files,
  });

async function stateRoot(context, prefix) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  context.after(() => rm(root, { recursive: true, force: true }));
  await chmod(root, 0o700);
  return root;
}

test('completes after an exact interrupted receipt publication', async (context) => {
  const root = await stateRoot(context, 'baci-bootstrap-retry-receipt-');

  for (const [label, names] of [
    ['json', ['receipt.json']],
    ['sha', ['receipt.sha256']],
    ['both', ['receipt.json', 'receipt.sha256']],
  ]) {
    const captured = capture(`bootstrap-retry-${label}`);
    const complete = completeBootstrap(captured, files, disabledUnits);
    const directory = await persistBootstrapCapture(root, captured);
    for (const name of names)
      await writeFile(
        join(directory, name),
        name === 'receipt.json'
          ? complete.receiptBytes
          : `${complete.receiptSha256}\n`,
        { mode: 0o600 }
      );

    await persistBootstrapReceipt(directory, complete);
    assert.equal((await readBootstrapState(directory)).phase, 'complete');
  }
});

test('refuses mismatched interrupted receipt residue', async (context) => {
  const root = await stateRoot(context, 'baci-bootstrap-retry-drift-');
  const captured = capture('bootstrap-retry-drift');
  const directory = await persistBootstrapCapture(root, captured);
  await writeFile(join(directory, 'receipt.json'), '{}', { mode: 0o600 });

  await assert.rejects(
    persistBootstrapReceipt(
      directory,
      completeBootstrap(captured, files, disabledUnits)
    ),
    /receipt residue mismatch/
  );
  assert.equal((await readBootstrapState(directory)).phase, 'captured');
});
