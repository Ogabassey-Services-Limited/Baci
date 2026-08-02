import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const helper = new URL(
  './install-bootstrap-rename-exchange.pl',
  import.meta.url
);

test('pins the Linux x86_64 renameat2 exchange syscall contract', async () => {
  const source = await readFile(helper, 'utf8');
  assert.match(source, /\$\^O ne 'linux'/);
  assert.match(source, /\$Config\{archname\} !~ \/\^x86_64-linux\//);
  assert.match(source, /syscall\(316, -100, \$left, -100, \$right, 2\)/);
});

test('atomically exchanges two same-directory files on Linux x86_64', {
  skip: process.platform !== 'linux' || process.arch !== 'x64',
}, async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-rename-exchange-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const left = join(
    root,
    `.baci-bootstrap-replacement-v2-${'1'.repeat(64)}-${'2'.repeat(64)}-test`
  );
  const right = join(root, 'bootstrap.sha256');
  await writeFile(left, 'new\n');
  await writeFile(right, 'old\n');

  await execute('/usr/bin/perl', [helper.pathname, left, right], {
    env: {},
    timeout: 5000,
  });

  assert.equal(await readFile(left, 'utf8'), 'old\n');
  assert.equal(await readFile(right, 'utf8'), 'new\n');
});

test('fails closed without mutating paths outside its exact authority', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-rename-refusal-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const left = join(root, 'ordinary-file');
  const right = join(root, 'bootstrap.sha256');
  await writeFile(left, 'left\n');
  await writeFile(right, 'right\n');

  await assert.rejects(
    execute('/usr/bin/perl', [helper.pathname, left, right], {
      env: {},
      timeout: 5000,
    })
  );
  assert.equal(await readFile(left, 'utf8'), 'left\n');
  assert.equal(await readFile(right, 'utf8'), 'right\n');
});

test('rejects wrong namespaces and cross-directory exchanges on Linux x86_64', {
  skip: process.platform !== 'linux' || process.arch !== 'x64',
}, async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-rename-boundary-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const other = join(root, 'other');
  await mkdir(other);
  const ordinary = join(root, 'ordinary-file');
  const right = join(root, 'bootstrap.sha256');
  const temporary = join(
    root,
    `.baci-bootstrap-replacement-v2-${'1'.repeat(64)}-${'2'.repeat(64)}-test`
  );
  await writeFile(ordinary, 'ordinary\n');
  await writeFile(right, 'right\n');
  await writeFile(temporary, 'temporary\n');
  const crossDirectory = join(other, 'bootstrap.sha256');
  await writeFile(crossDirectory, 'cross\n');

  for (const paths of [
    [ordinary, right],
    [temporary, crossDirectory],
  ])
    await assert.rejects(
      execute('/usr/bin/perl', [helper.pathname, ...paths], {
        env: {},
        timeout: 5000,
      })
    );
  assert.equal(await readFile(ordinary, 'utf8'), 'ordinary\n');
  assert.equal(await readFile(right, 'utf8'), 'right\n');
  assert.equal(await readFile(temporary, 'utf8'), 'temporary\n');
  assert.equal(await readFile(crossDirectory, 'utf8'), 'cross\n');
});

test('propagates a denied renameat2 syscall without mutation', {
  skip:
    process.platform !== 'linux' ||
    process.arch !== 'x64' ||
    process.getuid?.() === 0,
}, async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-rename-denied-'));
  context.after(async () => {
    await chmod(root, 0o700);
    await rm(root, { recursive: true, force: true });
  });
  const left = join(
    root,
    `.baci-bootstrap-replacement-v2-${'1'.repeat(64)}-${'2'.repeat(64)}-test`
  );
  const right = join(root, 'bootstrap.sha256');
  await writeFile(left, 'new\n');
  await writeFile(right, 'old\n');
  await chmod(root, 0o555);

  await assert.rejects(
    execute('/usr/bin/perl', [helper.pathname, left, right], {
      env: {},
      timeout: 5000,
    })
  );
  assert.equal(await readFile(left, 'utf8'), 'new\n');
  assert.equal(await readFile(right, 'utf8'), 'old\n');
});

test('rejects NUL-bearing paths before invoking the helper', () => {
  assert.throws(
    () =>
      execute('/usr/bin/perl', [
        helper.pathname,
        '/tmp/left\0suffix',
        '/tmp/right',
      ]),
    { code: 'ERR_INVALID_ARG_VALUE' }
  );
});
