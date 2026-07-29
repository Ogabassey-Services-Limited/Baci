import assert from 'node:assert/strict';
import {
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  persistBootstrapReplacementIntent,
  persistBootstrapReplacementReceipt,
} from './install-bootstrap-replacement-receipt.mjs';

const source = (value) => value.repeat(40);
const digest = (value) => value.repeat(64);
const intent = {
  schemaVersion: 1,
  baselineKind: 'complete',
  baselineSourceSha: source('a'),
  baselineStateSha256: digest('1'),
  sourceSha: source('b'),
  captureSha256: digest('2'),
  installedProjectionSha256: digest('3'),
  pathSetSha256: digest('4'),
  policyFileSha256: digest('5'),
  authorityChain: [
    {
      journalTipSha256: digest('6'),
      sealReceiptSha256: digest('7'),
      sourceSha: source('a'),
      stateSha256: digest('8'),
    },
    {
      journalTipSha256: digest('9'),
      sealReceiptSha256: digest('a'),
      sourceSha: source('b'),
      stateSha256: digest('b'),
    },
  ],
  transitionPaths: ['/srv/baci-cwv/sealed/bootstrap.sha256'],
};

test('an interrupted value write cannot publish a partial intent or receipt', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-bootstrap-atomic-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const cases = [
    ['replacement-intent', intent, persistBootstrapReplacementIntent],
    [
      'replacement-receipt',
      { ...intent, receiptSha256: digest('c') },
      persistBootstrapReplacementReceipt,
    ],
  ];

  for (const [name, value, persist] of cases) {
    await assert.rejects(
      persist(directory, value, {
        writeValue: async (handle) => {
          await handle.writeFile('{');
          throw new Error('interrupted value write');
        },
      }),
      /interrupted value write/
    );
    await assert.rejects(readFile(join(directory, `${name}.json`)), /ENOENT/);

    await persist(directory, value);
    const path = join(directory, `${name}.json`);
    const expected = await readFile(path, 'utf8');
    const inode = (await stat(path)).ino;
    await persist(directory, value);
    assert.equal(await readFile(path, 'utf8'), expected);
    assert.equal((await stat(path)).ino, inode);
  }
});

test('never follows or replaces an existing receipt symlink', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-bootstrap-symlink-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const victim = join(directory, 'victim');
  await writeFile(victim, 'do not replace', { mode: 0o600 });
  await symlink(victim, join(directory, 'replacement-intent.json'));

  await assert.rejects(
    persistBootstrapReplacementIntent(directory, intent),
    /replacement intent drift/
  );
  assert.equal(await readFile(victim, 'utf8'), 'do not replace');
});
