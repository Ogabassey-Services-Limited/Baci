import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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

const script = new URL('./install-account-identity.sh', import.meta.url);

test('fails closed unless the runner account is the locked singleton identity', async () => {
  const source = await readFile(script, 'utf8');
  for (const token of [
    'runner group collision',
    'runner account collision',
    'runner supplementary group drift',
    'runner account must be locked',
    '$4 == gid',
    '/nonexistent',
    '/usr/sbin/nologin',
  ])
    assert.ok(source.includes(token), token);
  const invocation = spawnSync(
    '/bin/sh',
    [script.pathname, 'wrong', '1', '1'],
    {
      encoding: 'utf8',
    }
  );
  assert.equal(invocation.status, 65);
  assert.match(invocation.stderr, /unexpected runner identity/);
});

async function writeTool(directory, name, source) {
  const path = join(directory, name);
  await writeFile(path, `#!/bin/sh\n${source}`);
  await chmod(path, 0o700);
  return path;
}

async function fixture(context, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'baci-account-identity-'));
  context.after(() => rm(root, { force: true, recursive: true }));
  const state = join(root, 'state');
  await mkdir(state);
  const getent = await writeTool(
    root,
    'getent',
    `case "$1" in
  group) [ -f "$BACI_ACCOUNT_STATE/group" ] || exit 2; /bin/cat "$BACI_ACCOUNT_STATE/group" ;;
  passwd) [ -f "$BACI_ACCOUNT_STATE/passwd" ] || exit 2; /bin/cat "$BACI_ACCOUNT_STATE/passwd" ;;
esac`
  );
  const groupadd = await writeTool(
    root,
    'groupadd',
    `printf '%s\\n' 'baci-cwv:x:10001:' >"$BACI_ACCOUNT_STATE/group"`
  );
  const useradd = await writeTool(
    root,
    'useradd',
    `printf '%s\\n' 'baci-cwv:x:10001:10001::/nonexistent:/usr/sbin/nologin' >"$BACI_ACCOUNT_STATE/passwd"`
  );
  const usermod = await writeTool(
    root,
    'usermod',
    `printf '%s\\n' locked >"$BACI_ACCOUNT_STATE/locked"`
  );
  const id = await writeTool(
    root,
    'id',
    `printf '%s\\n' "$BACI_ACCOUNT_GROUPS"`
  );
  const passwd = await writeTool(
    root,
    'passwd',
    `printf '%s\\n' "baci-cwv $BACI_ACCOUNT_LOCK 2026-01-01 0 99999 7 -1"`
  );
  if (options.group) await writeFile(join(state, 'group'), options.group);
  if (options.passwd) await writeFile(join(state, 'passwd'), options.passwd);
  const source = await readFile(script, 'utf8');
  const rewritten = source
    .replaceAll('/usr/bin/getent', getent)
    .replaceAll('/usr/sbin/groupadd', groupadd)
    .replaceAll('/usr/sbin/useradd', useradd)
    .replaceAll('/usr/sbin/usermod', usermod)
    .replaceAll('/usr/bin/id', id)
    .replaceAll('/usr/bin/passwd', passwd);
  const executable = join(root, 'install-account-identity.sh');
  await writeFile(executable, rewritten);
  await chmod(executable, 0o700);
  return {
    execute: () =>
      spawnSync('/bin/sh', [executable, 'baci-cwv', '10001', '10001'], {
        encoding: 'utf8',
        env: {
          ...process.env,
          BACI_ACCOUNT_GROUPS: options.groups ?? '10001',
          BACI_ACCOUNT_LOCK: options.lock ?? 'L',
          BACI_ACCOUNT_STATE: state,
        },
      }),
    root,
  };
}

test('creates and locks only the canonical isolated runner identity', async (context) => {
  const account = await fixture(context);
  const result = account.execute();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    await readFile(join(account.root, 'state/locked'), 'utf8'),
    'locked\n'
  );
});

test('refuses drift without locking a rejected isolated identity', async (context) => {
  for (const [options, diagnostic] of [
    [
      { group: 'baci-cwv:x:10001:\nother:x:10001:\n' },
      'runner group collision',
    ],
    [
      {
        group: 'baci-cwv:x:10001:\n',
        passwd:
          'baci-cwv:x:10001:10001::/nonexistent:/usr/sbin/nologin\nother:x:10002:10001::/nonexistent:/usr/sbin/nologin\n',
      },
      'runner account collision',
    ],
    [
      {
        group: 'baci-cwv:x:10001:\n',
        groups: '10001 10002',
        passwd: 'baci-cwv:x:10001:10001::/nonexistent:/usr/sbin/nologin\n',
      },
      'runner supplementary group drift',
    ],
    [
      {
        group: 'baci-cwv:x:10001:\n',
        lock: 'P',
        passwd: 'baci-cwv:x:10001:10001::/nonexistent:/usr/sbin/nologin\n',
      },
      'runner account must be locked',
    ],
    [
      {
        group: 'baci-cwv:x:10001:\n',
        passwd: 'baci-cwv:x:10001:10001::/home/baci:/bin/bash\n',
      },
      'runner account identity drift',
    ],
  ]) {
    const account = await fixture(context, options);
    const result = account.execute();
    assert.equal(result.status, 65, result.stderr);
    assert.match(result.stderr, new RegExp(diagnostic));
    await assert.rejects(readFile(join(account.root, 'state/locked')));
  }
});
