import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  persistBootstrapReplacementIntent,
  persistBootstrapReplacementReceipt,
  readBootstrapReplacementReceipt,
} from './install-bootstrap-replacement-receipt.mjs';

const oldSource = 'a'.repeat(40);
const newSource = 'b'.repeat(40);
const intent = {
  schemaVersion: 1,
  baselineKind: 'complete',
  baselineSourceSha: oldSource,
  baselineStateSha256: '5'.repeat(64),
  sourceSha: newSource,
  captureSha256: '6'.repeat(64),
  installedProjectionSha256: '7'.repeat(64),
  pathSetSha256: '8'.repeat(64),
  policyFileSha256: '9'.repeat(64),
  authorityChain: [
    {
      journalTipSha256: '1'.repeat(64),
      sealReceiptSha256: '2'.repeat(64),
      sourceSha: oldSource,
      stateSha256: '3'.repeat(64),
    },
    {
      journalTipSha256: '4'.repeat(64),
      sealReceiptSha256: '5'.repeat(64),
      sourceSha: newSource,
      stateSha256: '6'.repeat(64),
    },
  ],
  transitionPaths: ['/srv/baci-cwv/sealed/bootstrap.sha256'],
};

async function temporary(context, prefix) {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  context.after(async () =>
    import('node:fs/promises').then(({ rm }) =>
      rm(directory, { recursive: true, force: true })
    )
  );
  return directory;
}

test('resumes an interrupted intent digest write without changing value bytes', async (context) => {
  const directory = await temporary(context, 'baci-bootstrap-intent-');
  await assert.rejects(
    persistBootstrapReplacementIntent(directory, intent, {
      afterValue: () => {
        throw new Error('crash after replacement intent');
      },
    }),
    /crash after replacement intent/
  );
  const before = await readFile(
    join(directory, 'replacement-intent.json'),
    'utf8'
  );
  await persistBootstrapReplacementIntent(directory, intent);
  assert.equal(
    await readFile(join(directory, 'replacement-intent.json'), 'utf8'),
    before
  );
  assert.match(
    await readFile(join(directory, 'replacement-intent.sha256'), 'utf8'),
    /^[a-f0-9]{64}\n$/
  );
});

test('persists replacement receipts at mode 0600 under a restrictive umask', async (context) => {
  const directory = await temporary(context, 'baci-bootstrap-mode-');
  const previousUmask = process.umask(0o277);
  try {
    await persistBootstrapReplacementIntent(directory, intent);
  } finally {
    process.umask(previousUmask);
  }
  assert.equal(
    (await stat(join(directory, 'replacement-intent.json'))).mode & 0o777,
    0o600
  );
  assert.equal(
    (await stat(join(directory, 'replacement-intent.sha256'))).mode & 0o777,
    0o600
  );
});

test('resumes an interrupted receipt and refuses value drift', async (context) => {
  const directory = await temporary(context, 'baci-bootstrap-receipt-');
  const receipt = { ...intent, receiptSha256: 'a'.repeat(64) };
  await assert.rejects(
    persistBootstrapReplacementReceipt(directory, receipt, {
      afterValue: () => {
        throw new Error('crash after replacement receipt');
      },
    }),
    /crash after replacement receipt/
  );
  await assert.rejects(
    readBootstrapReplacementReceipt(directory),
    /ENOENT|replacement-receipt/
  );
  await persistBootstrapReplacementReceipt(directory, receipt);
  assert.deepEqual(await readBootstrapReplacementReceipt(directory), receipt);
  await persistBootstrapReplacementReceipt(directory, receipt);
  await assert.rejects(
    persistBootstrapReplacementReceipt(directory, {
      ...receipt,
      receiptSha256: 'b'.repeat(64),
    }),
    /replacement receipt drift/
  );
});
