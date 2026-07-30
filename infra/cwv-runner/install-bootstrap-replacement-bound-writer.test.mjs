import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  chmod,
  link,
  readFile,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { persistBoundReplacement } from './install-bootstrap-replacement-bound-writer.mjs';
import fixture from './install-bootstrap-replacement-receipt.test-fixture.mjs';

const stable = (value) =>
  Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, stable(value[key])])
        )
      : value;
const canonical = (value) => JSON.stringify(stable(value));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

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

test('retry retires only the exact published bound-value temporary hard link', async (context) => {
  const directory = await fixture.temporary(
    context,
    'baci-bootstrap-bound-retry-'
  );

  for (const [name, value] of [
    ['replacement-intent', fixture.intent],
    ['replacement-receipt', fixture.receipt],
  ]) {
    await persistBoundReplacement(directory, name, value, `${name} drift`);
    const destination = join(directory, `${name}.json`);
    const residue = join(
      directory,
      `.${name}.json.4100.11111111-1111-4111-8111-111111111111.tmp`
    );
    const unrelated = join(
      directory,
      `.${name}.json.4200.22222222-2222-4222-8222-222222222222.tmp`
    );
    await link(destination, residue);
    await writeFile(unrelated, await readFile(destination), { mode: 0o600 });

    await persistBoundReplacement(directory, name, value, `${name} drift`);

    await assert.rejects(stat(residue), /ENOENT/);
    assert.equal(
      await readFile(unrelated, 'utf8'),
      await readFile(destination, 'utf8')
    );
  }
});

test('retry retires a partially written bound-value temporary after process death before its first link', async (context) => {
  const directory = await fixture.temporary(
    context,
    'baci-bootstrap-bound-prelink-'
  );

  for (const [name, value] of [
    ['replacement-intent', fixture.intent],
    ['replacement-receipt', fixture.receipt],
  ]) {
    const residue = join(
      directory,
      `.${name}.json.4100.11111111-1111-4111-8111-111111111111.${sha256(canonical(value))}.tmp`
    );
    await writeFile(residue, canonical(value).slice(0, 17), { mode: 0o600 });

    await persistBoundReplacement(directory, name, value, `${name} drift`);

    await assert.rejects(stat(residue), /ENOENT/);
    assert.equal(
      await readFile(join(directory, `${name}.json`), 'utf8'),
      canonical(value)
    );
  }
});

test('refuses a digest-bound pre-link temporary with unsafe metadata', async (context) => {
  const directory = await fixture.temporary(
    context,
    'baci-bootstrap-bound-prelink-unsafe-'
  );
  const name = 'replacement-intent';
  const residue = join(
    directory,
    `.${name}.json.4100.11111111-1111-4111-8111-111111111111.${sha256(canonical(fixture.intent))}.tmp`
  );
  await writeFile(residue, canonical(fixture.intent), { mode: 0o600 });
  await chmod(residue, 0o644);

  await assert.rejects(
    persistBoundReplacement(directory, name, fixture.intent, `${name} drift`),
    /replacement-intent drift/
  );
  assert.equal(await readFile(residue, 'utf8'), canonical(fixture.intent));
});

test('refuses a digest-bound pre-link temporary with another hard link', async (context) => {
  const directory = await fixture.temporary(
    context,
    'baci-bootstrap-bound-prelink-linked-'
  );
  const name = 'replacement-intent';
  const residue = join(
    directory,
    `.${name}.json.4100.11111111-1111-4111-8111-111111111111.${sha256(canonical(fixture.intent))}.tmp`
  );
  await writeFile(residue, canonical(fixture.intent), { mode: 0o600 });
  await link(residue, join(directory, 'unexpected-hard-link'));

  await assert.rejects(
    persistBoundReplacement(directory, name, fixture.intent, `${name} drift`),
    /replacement-intent drift/
  );
  assert.equal(await readFile(residue, 'utf8'), canonical(fixture.intent));
});
