import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  chmod,
  link,
  lstat,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
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

test('refuses a truncated receipt destination from a direct-write crash', async (context) => {
  const root = await stateRoot(context, 'baci-bootstrap-retry-destination-');
  const captured = capture('bootstrap-retry-destination');
  const complete = completeBootstrap(captured, files, disabledUnits);
  const directory = await persistBootstrapCapture(root, captured);
  await writeFile(
    join(directory, 'receipt.json'),
    complete.receiptBytes.slice(0, 8),
    { mode: 0o600 }
  );

  await assert.rejects(
    persistBootstrapReceipt(directory, complete),
    /receipt residue mismatch/
  );
  assert.equal((await readBootstrapState(directory)).phase, 'captured');
});

test('removes an authenticated truncated receipt staging prefix before retrying', async (context) => {
  const root = await stateRoot(context, 'baci-bootstrap-retry-prefix-');
  const captured = capture('bootstrap-retry-prefix');
  const complete = completeBootstrap(captured, files, disabledUnits);
  const directory = await persistBootstrapCapture(root, captured);
  const temporary = join(
    directory,
    `.receipt.json.tmp.${sha256(complete.receiptBytes)}`
  );
  await writeFile(temporary, complete.receiptBytes.slice(0, 8), {
    mode: 0o600,
  });

  await persistBootstrapReceipt(directory, complete);
  await assert.rejects(lstat(temporary), { code: 'ENOENT' });
  assert.equal((await readBootstrapState(directory)).phase, 'complete');
});

test('retires authenticated post-link receipt staging hard links after a crash', async (context) => {
  const root = await stateRoot(context, 'baci-bootstrap-retry-linked-');
  const captured = capture('bootstrap-retry-linked');
  const complete = completeBootstrap(captured, files, disabledUnits);
  const directory = await persistBootstrapCapture(root, captured);
  const pairs = [
    ['receipt.json', complete.receiptBytes],
    ['receipt.sha256', `${complete.receiptSha256}\n`],
  ];

  for (const [name, bytes] of pairs) {
    const temporary = join(directory, `.${name}.tmp.${sha256(bytes)}`);
    await writeFile(temporary, bytes, { mode: 0o600 });
    await link(temporary, join(directory, name));
  }

  await persistBootstrapReceipt(directory, complete);
  for (const [name, bytes] of pairs) {
    const temporary = join(directory, `.${name}.tmp.${sha256(bytes)}`);
    await assert.rejects(lstat(temporary), { code: 'ENOENT' });
    assert.equal((await lstat(join(directory, name))).nlink, 1);
  }
  assert.equal((await readBootstrapState(directory)).phase, 'complete');
});

test('retires complete-phase publication remnants from interrupted processes', async (context) => {
  const root = await stateRoot(context, 'baci-bootstrap-retry-phase-');
  const captured = capture('bootstrap-retry-phase');
  const complete = completeBootstrap(captured, files, disabledUnits);
  const directory = await persistBootstrapCapture(root, captured);
  const remnants = [
    join(directory, `.phase-${process.pid}`),
    join(directory, '.phase-999999'),
  ];
  await writeFile(remnants[0], 'complete\n', { mode: 0o600 });
  await writeFile(remnants[1], 'comple', { mode: 0o600 });

  await persistBootstrapReceipt(directory, complete);
  for (const remnant of remnants)
    await assert.rejects(lstat(remnant), { code: 'ENOENT' });
  assert.equal((await readBootstrapState(directory)).phase, 'complete');
});

test('refuses unauthenticated completion-phase remnants', async (context) => {
  const root = await stateRoot(context, 'baci-bootstrap-retry-phase-refuse-');
  for (const [label, name, bytes, mode] of [
    ['foreign', '.phase-foreign', 'complete\n', 0o600],
    ['bytes', '.phase-999997', 'foreign', 0o600],
    ['mode', '.phase-999996', 'complete\n', 0o644],
  ]) {
    const captured = capture(`bootstrap-retry-phase-${label}`);
    const complete = completeBootstrap(captured, files, disabledUnits);
    const directory = await persistBootstrapCapture(root, captured);
    await writeFile(join(directory, name), bytes, { mode });
    await assert.rejects(
      persistBootstrapReceipt(directory, complete),
      /receipt residue mismatch/
    );
    assert.equal((await readBootstrapState(directory)).phase, 'captured');
  }
  const captured = capture('bootstrap-retry-phase-symlink');
  const complete = completeBootstrap(captured, files, disabledUnits);
  const directory = await persistBootstrapCapture(root, captured);
  await writeFile(join(directory, 'phase-target'), 'complete\n', {
    mode: 0o600,
  });
  await symlink('phase-target', join(directory, '.phase-999995'));
  await assert.rejects(
    persistBootstrapReceipt(directory, complete),
    /receipt residue mismatch/
  );
});

test('refuses matching post-link names that are not the same hard link', async (context) => {
  const root = await stateRoot(context, 'baci-bootstrap-retry-unlinked-');
  const captured = capture('bootstrap-retry-unlinked');
  const complete = completeBootstrap(captured, files, disabledUnits);
  const directory = await persistBootstrapCapture(root, captured);
  const temporary = join(
    directory,
    `.receipt.json.tmp.${sha256(complete.receiptBytes)}`
  );
  await writeFile(temporary, complete.receiptBytes, { mode: 0o600 });
  await writeFile(join(directory, 'receipt.json'), complete.receiptBytes, {
    mode: 0o600,
  });

  await assert.rejects(
    persistBootstrapReceipt(directory, complete),
    /receipt residue mismatch/
  );
  assert.equal((await readBootstrapState(directory)).phase, 'captured');
});

test('refuses foreign receipt staging residue', async (context) => {
  const root = await stateRoot(context, 'baci-bootstrap-retry-foreign-');
  const captured = capture('bootstrap-retry-foreign');
  const complete = completeBootstrap(captured, files, disabledUnits);
  const directory = await persistBootstrapCapture(root, captured);
  await writeFile(
    join(directory, `.receipt.json.tmp.${'f'.repeat(64)}`),
    complete.receiptBytes,
    { mode: 0o600 }
  );

  await assert.rejects(
    persistBootstrapReceipt(directory, complete),
    /receipt residue mismatch/
  );
  assert.equal((await readBootstrapState(directory)).phase, 'captured');
});
