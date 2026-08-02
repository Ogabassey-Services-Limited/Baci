import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const root = new URL('./', import.meta.url);

async function executable(directory, name, source) {
  const target = path.join(directory, name);
  await writeFile(target, `#!/bin/sh\n${source}\n`);
  await chmod(target, 0o755);
  return target;
}

test('root_mode resolves installed owner and group identities instead of assuming gid 10001', async (context) => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), 'baci-cwv-root-mode-')
  );
  context.after(async () => {
    const { rm } = await import('node:fs/promises');
    await rm(directory, { force: true, recursive: true });
  });
  const source = await readFile(new URL('install.sh', root), 'utf8');
  const functionSource = source.match(/root_mode\(\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(functionSource, 'root_mode function');
  const id = await executable(
    directory,
    'id',
    '[ "$1" = -u ] && [ "$3" = root ] && printf "0\\n" && exit 0\n[ "$1" = -u ] && [ "$3" = baci-cwv ] && printf "4242\\n" && exit 0\nexit 1'
  );
  const getent = await executable(
    directory,
    'getent',
    '[ "$1" = group ] && [ "$2" = root ] && printf "root:x:0:\\n" && exit 0\n[ "$1" = group ] && [ "$2" = baci-cwv ] && printf "baci-cwv:x:4242:\\n" && exit 0\nexit 2'
  );
  const stat = await executable(
    directory,
    'stat',
    'printf "%s\\n" "$FAKE_STAT"'
  );
  const harness = functionSource
    .replaceAll('/usr/bin/id', id)
    .replaceAll('/usr/bin/getent', getent)
    .replaceAll('/usr/bin/stat', stat);
  const run = (expected, specification) =>
    spawnSync(
      '/bin/sh',
      ['-c', `${harness}\nroot_mode /fixture ${specification}`],
      { encoding: 'utf8', env: { ...process.env, FAKE_STAT: expected } }
    );

  assert.equal(run('0:4242:640', 'root:baci-cwv:0640').status, 0);
  assert.equal(run('0:0:600', 'root:root:0600').status, 0);
  assert.notEqual(run('0:10001:640', 'root:baci-cwv:0640').status, 0);
  assert.doesNotMatch(functionSource, /10001/);
});
