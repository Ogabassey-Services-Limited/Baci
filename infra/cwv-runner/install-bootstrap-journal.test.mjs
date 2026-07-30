import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdtemp, open, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  appendBootstrapJournal,
  beginBootstrap,
  persistBootstrapCapture,
  readBootstrapState,
} from './install-bootstrap.mjs';

const digest = (value) => createHash('sha256').update(value).digest('hex');
const destination = '/etc/baci-cwv/daemon.json';
const event = (value) => ({
  action: 'install-file',
  path: destination,
  sha256: digest(value),
});

async function fixture(context) {
  const root = await mkdtemp(join(tmpdir(), 'baci-bootstrap-journal-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  await chmod(root, 0o700);
  const file = { sha256: digest('daemon'), mode: '0644', owner: 'root:root' };
  const capture = beginBootstrap({
    transactionId: 'bootstrap-journal',
    sourceSha: 'a'.repeat(40),
    sourceManifestSha256: 'b'.repeat(64),
    policyFileSha256: 'c'.repeat(64),
    prior: { [destination]: { absent: true } },
    files: { [destination]: file },
  });
  const directory = await persistBootstrapCapture(root, capture);
  return { directory, journal: join(directory, 'journal.ndjson') };
}

test('recovers a durably truncated final journal row before retrying the append', async (context) => {
  const value = await fixture(context);
  const first = await appendBootstrapJournal(value.directory, event('first'));
  const handle = await open(value.journal, 'a');
  try {
    await handle.write('{"sequence":2,"previousSha256":"truncated');
    await handle.sync();
  } finally {
    await handle.close();
  }

  const recovered = await readBootstrapState(value.directory);
  assert.deepEqual(recovered.journal, [first]);
  assert.equal((await readFile(value.journal, 'utf8')).endsWith('\n'), true);

  const second = await appendBootstrapJournal(value.directory, event('second'));
  const retried = await readBootstrapState(value.directory);
  assert.equal(retried.journal.length, 2);
  assert.equal(second.sequence, 2);
  assert.equal(second.previousSha256, first.sha256);
});

test('does not recover a corrupt newline-committed journal row', async (context) => {
  const value = await fixture(context);
  const handle = await open(value.journal, 'a');
  try {
    await handle.write('{"sequence":1}\n');
    await handle.sync();
  } finally {
    await handle.close();
  }

  await assert.rejects(
    () => readBootstrapState(value.directory),
    /journal chain mismatch/
  );
});
