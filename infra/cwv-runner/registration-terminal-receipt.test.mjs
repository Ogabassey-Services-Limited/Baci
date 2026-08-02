import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  chmod,
  mkdir,
  mkdtemp,
  open,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  publishRegistrationTerminalReceipt,
  readRegistrationTerminalReceipt,
  readRegistrationTerminalState,
  readSealedRunnerIdentity,
  registrationTerminalState,
} from './registration-terminal-receipt.mjs';

const receipt = Object.freeze({
  captureSha256: 'a'.repeat(64),
  cleanupSha256: 'f'.repeat(64),
  imageDigest: `sha256:${'b'.repeat(64)}`,
  registrationReleaseSha256: 'c'.repeat(64),
  runnerIdentitySha256: 'd'.repeat(64),
  schemaVersion: 1,
  sealedRunnerSha256: 'e'.repeat(64),
});
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function fixture(context) {
  const root = await mkdtemp(join(tmpdir(), 'baci-terminal-receipt-'));
  const receiptRoot = join(root, 'receipts');
  const identityPath = join(root, 'runner-identity.json');
  await mkdir(receiptRoot, { mode: 0o700 });
  await chmod(receiptRoot, 0o700);
  context.after(() => rm(root, { force: true, recursive: true }));
  return {
    assertRoot: () => undefined,
    identityOwner: { gid: process.getgid(), uid: process.getuid() },
    identityPath,
    receiptOwner: { gid: process.getgid(), uid: process.getuid() },
    receiptRoot,
  };
}

test('publishes, fsyncs, and rereads one canonical terminal receipt', async (context) => {
  const options = await fixture(context);
  const published = await publishRegistrationTerminalReceipt(receipt, options);
  const reread = await readRegistrationTerminalReceipt(options);

  assert.deepEqual(reread, published);
  assert.deepEqual(published.receipt, receipt);
  assert.match(published.sha256, /^[a-f0-9]{64}$/);
  assert.match(
    await readFile(
      join(options.receiptRoot, 'registration-terminal-receipt.json'),
      'utf8'
    ),
    /^\{"receipt":/
  );
});

test('treats only a fully absent terminal receipt as absent and rejects malformed bytes', async (context) => {
  const options = await fixture(context);
  assert.equal(await readRegistrationTerminalReceipt(options), undefined);
  const path = join(options.receiptRoot, 'registration-terminal-receipt.json');
  await writeFile(path, '{"receipt":{}}', { mode: 0o400 });
  await chmod(path, 0o400);
  await assert.rejects(
    () => readRegistrationTerminalReceipt(options),
    /registration terminal receipt refused/
  );
});

test('reads only a canonical fixed sealed runner identity', async (context) => {
  const options = await fixture(context);
  await writeFile(
    options.identityPath,
    '{"generation":1,"id":41,"name":"baci-cwv-measurement-01"}',
    { mode: 0o400 }
  );
  await chmod(options.identityPath, 0o400);
  const identity = await readSealedRunnerIdentity(options);
  assert.equal(identity.identity.id, 41);
  assert.match(identity.sha256, /^[a-f0-9]{64}$/);
  await chmod(options.identityPath, 0o600);
  await writeFile(
    options.identityPath,
    '{"id":41,"generation":1,"name":"baci-cwv-measurement-01"}'
  );
  await chmod(options.identityPath, 0o400);
  await assert.rejects(
    () => readSealedRunnerIdentity(options),
    /registration terminal receipt refused/
  );
});

test('leaves no terminal receipt when publication fails before rename', async (context) => {
  const options = await fixture(context);
  await assert.rejects(
    () =>
      publishRegistrationTerminalReceipt(receipt, {
        ...options,
        rename: () => {
          throw new Error('crash before publish');
        },
      }),
    /registration terminal receipt refused/
  );
  assert.equal(await readRegistrationTerminalReceipt(options), undefined);
  assert.deepEqual(await readdir(options.receiptRoot), []);
});

test('retains the publication error when temporary receipt cleanup also fails', async (context) => {
  const options = await fixture(context);
  await assert.rejects(
    () =>
      publishRegistrationTerminalReceipt(receipt, {
        ...options,
        rename: () => {
          throw new TypeError('original publication failure');
        },
        unlink: () => {
          throw new Error('temporary cleanup failure');
        },
      }),
    /original publication failure/
  );
});

test('retries the receipt-parent sync before reusing identical durable bytes', async (context) => {
  const options = await fixture(context);
  await publishRegistrationTerminalReceipt(receipt, options);
  let parentSyncs = 0;
  const openWithObservedParentSync = async (path, flags, mode) => {
    const handle = await open(path, flags, mode);
    if (path !== options.receiptRoot) return handle;
    return {
      close: () => handle.close(),
      stat: () => handle.stat(),
      sync: async () => {
        parentSyncs += 1;
        await handle.sync();
      },
    };
  };

  await publishRegistrationTerminalReceipt(receipt, {
    ...options,
    open: openWithObservedParentSync,
  });
  assert.equal(parentSyncs, 1);

  await assert.rejects(
    publishRegistrationTerminalReceipt(receipt, {
      ...options,
      open: async (path, flags, mode) => {
        if (path === options.receiptRoot)
          throw new Error('simulated parent fsync failure');
        return await open(path, flags, mode);
      },
    }),
    /registration terminal receipt refused/
  );
});

test('requires terminal receipt and sealed identity to be absent together or bind exactly', () => {
  const identity = { sha256: 'f'.repeat(64) };
  const terminal = {
    receipt: { ...receipt, runnerIdentitySha256: identity.sha256 },
  };
  assert.deepEqual(registrationTerminalState(undefined, undefined), {
    captureSha256: null,
    cleanupSha256: null,
    registrationComplete: false,
    imageDigest: null,
    registrationReleaseSha256: null,
    runnerIdentitySha256: null,
  });
  for (const [stored, sealed] of [
    [terminal, undefined],
    [undefined, identity],
    [terminal, { sha256: '0'.repeat(64) }],
  ])
    assert.throws(
      () => registrationTerminalState(stored, sealed),
      /registration terminal receipt refused/
    );
  assert.deepEqual(registrationTerminalState(terminal, identity), {
    captureSha256: receipt.captureSha256,
    cleanupSha256: receipt.cleanupSha256,
    registrationComplete: true,
    imageDigest: receipt.imageDigest,
    registrationReleaseSha256: receipt.registrationReleaseSha256,
    runnerIdentitySha256: identity.sha256,
  });
});

test('retains every terminal receipt binding in the durable terminal state', async (context) => {
  const options = await fixture(context);
  const identityBytes = Buffer.from(
    '{"generation":1,"id":41,"name":"baci-cwv-measurement-01"}'
  );
  await writeFile(options.identityPath, identityBytes, { mode: 0o400 });
  await chmod(options.identityPath, 0o400);
  const bound = { ...receipt, runnerIdentitySha256: digest(identityBytes) };
  await publishRegistrationTerminalReceipt(bound, options);

  assert.deepEqual(await readRegistrationTerminalState(options), {
    captureSha256: bound.captureSha256,
    cleanupSha256: bound.cleanupSha256,
    registrationComplete: true,
    imageDigest: bound.imageDigest,
    registrationReleaseSha256: bound.registrationReleaseSha256,
    runnerIdentitySha256: bound.runnerIdentitySha256,
  });
});
