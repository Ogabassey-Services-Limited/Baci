import assert from 'node:assert/strict';
import {
  chmod,
  mkdtemp,
  open,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  canonicalJson,
  createCapture,
  inspectProgress,
  recordJournalEntry,
  validatePriorState,
  verifyCapture,
} from './campaign-state.mjs';
import { withJournalLock } from './campaign-state-journal-lock.mjs';

const host = { bootId: 'boot-a', hostname: 'ogabassey' };
const priorState = {
  schemaVersion: 1,
  cron: {
    sha256: 'a'.repeat(64),
    archiveSha256: 'a'.repeat(64),
    archivePath: '/srv/baci-cwv/campaigns/tx/crontab.before',
    serviceActive: true,
    serviceEnabled: true,
  },
  resources: { runners: [], timers: [], containers: [], slices: [] },
  network: {
    ipForward: 1,
    campaignMark: 0xb1234567,
    collisions: [],
    accountingTablePresent: false,
    baselineSha256: 'b'.repeat(64),
    externalInterface: { name: 'eth0', ifindex: 2 },
    inventories: Object.fromEntries(
      'nftables iptables ip6tables ipRules4 ipRules6 tc conntrack addresses routes dockerNetworks'
        .split(' ')
        .map((key) => [key, 'c'.repeat(64)])
    ),
  },
};

test('refuses an unsafe campaign root and creates root-private durable state', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cwv-state-'));
  await chmod(root, 0o755);
  await assert.rejects(
    () =>
      createCapture({
        root,
        transactionId: 'tx-unsafe-root',
        mode: 'campaign',
        host,
        priorState,
      }),
    /secure campaign root/
  );
  await chmod(root, 0o700);
  const capture = await createCapture({
    root,
    transactionId: 'tx-private-state',
    mode: 'campaign',
    host,
    priorState,
  });
  assert.equal(
    (await stat(path.join(root, 'tx-private-state'))).mode & 0o777,
    0o700
  );
  assert.equal((await stat(capture.capturePath)).mode & 0o777, 0o600);
  assert.equal((await stat(capture.shaPath)).mode & 0o777, 0o600);
});

test('records journal sequence anomalies without allowing them to alter capture authority', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cwv-state-'));
  await chmod(root, 0o700);
  const capture = await createCapture({
    root,
    transactionId: 'tx-journal-anomaly',
    mode: 'campaign',
    host,
    priorState,
  });
  const first = await recordJournalEntry({
    root,
    transactionId: 'tx-journal-anomaly',
    action: 'first',
    resource: 'one',
  });
  const second = await recordJournalEntry({
    root,
    transactionId: 'tx-journal-anomaly',
    action: 'second',
    resource: 'two',
  });
  const journal = path.join(root, 'tx-journal-anomaly', 'journal');
  await rename(
    path.join(journal, `000002-${second.sha256}.json`),
    path.join(journal, `000003-${second.sha256}.json`)
  );
  await writeFile(path.join(journal, 'notes.txt'), 'not a receipt\n');
  assert.match(
    (
      await inspectProgress({ root, transactionId: 'tx-journal-anomaly' })
    ).anomalies.join(','),
    /journal-sequence|journal-unexpected/
  );
  assert.equal(
    (
      await verifyCapture({
        root,
        transactionId: 'tx-journal-anomaly',
        expectedSha256: capture.sha256,
        host,
      })
    ).sha256,
    capture.sha256
  );
  assert.equal(first.sequence, 1);
});

test('requires a complete collision array and rejects authorization-shaped values only', () => {
  assert.throws(
    () =>
      validatePriorState({
        ...priorState,
        network: { ...priorState.network, collisions: undefined },
      }),
    /collision inventory required/
  );
  assert.throws(
    () => canonicalJson({ authorization: 'secret' }),
    /secret-shaped/
  );
  assert.throws(
    () => canonicalJson({ accessToken: 'secret' }),
    /secret-shaped/
  );
  assert.doesNotThrow(() => canonicalJson({ monkey: 'safe' }));
  assert.throws(
    () =>
      validatePriorState({
        ...priorState,
        network: {
          ...priorState.network,
          collisions: [{ source: '', mask: -1, value: 0 }],
        },
      }),
    /malformed collision inventory/
  );
});

test('serializes concurrent journal entries into one gapless hash chain', async () => {
  const entryCount = 32;
  const root = await mkdtemp(path.join(os.tmpdir(), 'cwv-state-'));
  await chmod(root, 0o700);
  await createCapture({
    root,
    transactionId: 'tx-concurrent-journal',
    mode: 'campaign',
    host,
    priorState,
  });
  const entries = await Promise.all(
    Array.from({ length: entryCount }, (_, index) =>
      recordJournalEntry({
        root,
        transactionId: 'tx-concurrent-journal',
        action: `action-${index}`,
        resource: `resource-${index}`,
      })
    )
  );
  assert.deepEqual(
    entries.map((entry) => entry.sequence).sort((left, right) => left - right),
    Array.from({ length: entryCount }, (_, index) => index + 1)
  );
  assert.deepEqual(
    await inspectProgress({ root, transactionId: 'tx-concurrent-journal' }),
    { anomalies: ['phase-invalid-or-missing'], phase: null }
  );
});

test('fails closed on stale journal locks pending explicit operator recovery', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cwv-journal-lock-'));
  await chmod(directory, 0o700);
  await writeFile(
    path.join(directory, '.journal.lock'),
    JSON.stringify({ pid: 999_999_999, token: 'a'.repeat(36) }),
    { mode: 0o600 }
  );
  await assert.rejects(
    withJournalLock(directory, async () => undefined),
    /stale journal lock requires operator recovery/
  );
  await assert.doesNotReject(stat(path.join(directory, '.journal.lock')));
});

test('journal cleanup never unlinks a replacement lock identity', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cwv-journal-lock-'));
  await chmod(directory, 0o700);
  const lock = path.join(directory, '.journal.lock');
  await withJournalLock(directory, async () => {
    await rename(lock, `${lock}.original`);
    await writeFile(
      lock,
      JSON.stringify({ pid: process.pid, token: 'b'.repeat(36) }),
      { mode: 0o600 }
    );
    await rm(`${lock}.original`);
  });
  await assert.doesNotReject(stat(lock));
  await assert.rejects(stat(`${lock}.original`));
});

test('closes a newly opened journal handle while preserving a failed lock', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cwv-journal-lock-'));
  await chmod(directory, 0o700);
  let closed = false;
  const fileSystem = {
    open: async (...args) => {
      const handle = await open(...args);
      return {
        close: async () => {
          closed = true;
          await handle.close();
        },
        stat: () => handle.stat(),
        sync: () => handle.sync(),
        writeFile: () =>
          Promise.reject(
            Object.assign(new Error('lock initialization failed'), {
              code: 'EIO',
            })
          ),
      };
    },
  };

  await assert.rejects(
    withJournalLock(directory, async () => undefined, fileSystem),
    /lock initialization failed/
  );
  assert.equal(closed, true);
  await assert.doesNotReject(stat(path.join(directory, '.journal.lock')));
});

test('restore checks every multi-row state assertion without an AND-list mask', async () => {
  const restore = await readFile(
    new URL('./campaign-restore.sh', import.meta.url),
    'utf8'
  );
  const verification = restore.slice(
    restore.indexOf('verify_resource_state()'),
    restore.indexOf('verify_restored()')
  );
  assert.doesNotMatch(verification, /\] && \[/);
  assert.match(
    verification,
    /assert_equal "\$actual_active" "\$expected_active"/
  );
  assert.match(
    verification,
    /assert_equal "\$actual_enabled" "\$expected_enabled"/
  );
});
