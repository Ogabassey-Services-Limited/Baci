import assert from 'node:assert/strict';
import { readFile, stat, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { persistBoundReplacement } from './install-bootstrap-replacement-bound-writer.mjs';
import fixture from './install-bootstrap-replacement-receipt.test-fixture.mjs';

test('an interrupted value write cannot publish a partial intent or receipt', async (context) => {
  const directory = await fixture.temporary(context, 'baci-bootstrap-atomic-');
  const cases = [
    ['replacement-intent', fixture.intent],
    ['replacement-receipt', fixture.receipt],
  ];

  for (const [name, value] of cases) {
    await assert.rejects(
      persistBoundReplacement(directory, name, value, `${name} drift`, {
        writeValue: async (handle) => {
          await handle.writeFile('{');
          throw new Error('interrupted value write');
        },
      }),
      /interrupted value write/
    );
    await assert.rejects(readFile(join(directory, `${name}.json`)), /ENOENT/);

    await persistBoundReplacement(directory, name, value, `${name} drift`);
    const path = join(directory, `${name}.json`);
    const expected = await readFile(path, 'utf8');
    const inode = (await stat(path)).ino;
    await persistBoundReplacement(directory, name, value, `${name} drift`);
    assert.equal(await readFile(path, 'utf8'), expected);
    assert.equal((await stat(path)).ino, inode);
  }
});

test('never follows or replaces an existing bound-value symlink', async (context) => {
  const directory = await fixture.temporary(context, 'baci-bootstrap-symlink-');
  const victim = join(directory, 'victim');
  await writeFile(victim, 'do not replace', { mode: 0o600 });
  await symlink(victim, join(directory, 'replacement-intent.json'));

  await assert.rejects(
    persistBoundReplacement(
      directory,
      'replacement-intent',
      fixture.intent,
      'replacement intent drift'
    ),
    /replacement intent drift/
  );
  assert.equal(await readFile(victim, 'utf8'), 'do not replace');
});
