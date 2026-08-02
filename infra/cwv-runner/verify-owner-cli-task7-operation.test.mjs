import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { verify } from 'node:crypto';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const directory = path.dirname(new URL(import.meta.url).pathname);

test('reads the private auditor App registration through an App JWT', async () => {
  const source = await readFile(
    path.join(directory, 'verify-owner-cli.sh'),
    'utf8'
  );
  assert.match(
    source,
    /app_jwt\(\) \{[^}]*assert_owner_input "\$key" pem; assert_owner_input "\$id_file" numeric;/
  );

  assert.match(
    source,
    /read-auditor-app-registration\) jwt=\$\(app_jwt\) \|\| refuse; node=\$\(verified_task7_node\) \|\| refuse; printf '%s' "\$jwt" \| exec \/usr\/bin\/env -i "\$node" --input-type=module -e /
  );
  assert.doesNotMatch(source, /\/usr\/bin\/printf '%s' "\$jwt"/);
  assert.match(source, /Authorization:`Bearer \$\{jwt\}`/);
  assert.match(source, /const deadline=setTimeout\(.*30000\)/);
  assert.match(source, /clearTimeout\(deadline\)/);
  assert.match(
    source,
    /bytes>1048576\)\{clearTimeout\(deadline\);fail\(\);request\.destroy\(\)/
  );
  assert.doesNotMatch(source, /\/repos\/\$REPOSITORY\/installation/);
  assert.doesNotMatch(
    source,
    /read-auditor-app-installation|read-auditor-app-permissions/
  );
});

test('uses Bearer auth and never invokes gh when App JWT minting fails', async (t) => {
  const source = await readFile(
    path.join(directory, 'verify-owner-cli.sh'),
    'utf8'
  );
  const root = await mkdtemp(path.join(tmpdir(), 'baci-cwv-jwt-exec-test-'));
  t.after(() => rm(root, { force: true, recursive: true }));
  const nodeDirectory = path.join(root, 'tools', 'node', 'bin');
  await mkdir(nodeDirectory, { recursive: true, mode: 0o700 });
  const argumentsFile = path.join(root, 'arguments');
  const environmentFile = path.join(root, 'environment');
  const tokenFile = path.join(root, 'gh-token');
  await writeFile(
    path.join(nodeDirectory, 'node'),
    `#!/bin/sh\n/usr/bin/env > '${environmentFile}'\nprintf '%s\\n' "$@" > '${argumentsFile}'\n/bin/cat > '${tokenFile}'\nprintf '{}\\n'\n`,
    { mode: 0o500 }
  );
  const execTask7 = source.slice(
    source.indexOf('exec_task7() {'),
    source.indexOf('emit_task9_token()')
  );
  const harness = path.join(root, 'exec-task7.sh');
  const harnessPrefix = `#!/bin/sh\nset -eu\nreadonly API_VERSION=2026-03-10 REPOSITORY=ogabasseyy/Baci\nrefuse() { exit 65; }\n${execTask7}\nroot=$1\npurpose=task7-provisioning\noperation=read-auditor-app-registration\n`;

  await writeFile(
    harness,
    `${harnessPrefix}app_jwt() { printf '%s' a.b.c; }\nverified_task7_node() { printf '%s' "$root/tools/node/bin/node"; }\nexec_task7\n`,
    { mode: 0o700 }
  );
  const success = spawnSync(harness, [root], {
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_EXTRA_CA_CERTS: '/tmp/attacker-ca.pem',
      NODE_OPTIONS: '--require=/tmp/attacker-preload.cjs',
      NODE_TLS_REJECT_UNAUTHORIZED: '0',
    },
  });
  assert.equal(success.status, 0, success.stderr);
  assert.equal(await readFile(tokenFile, 'utf8'), 'a.b.c');
  const argumentsText = await readFile(argumentsFile, 'utf8');
  assert.match(argumentsText, /^--input-type=module\n-e\n/);
  assert.doesNotMatch(argumentsText, /a\.b\.c/);
  const environmentText = await readFile(environmentFile, 'utf8');
  assert.doesNotMatch(environmentText, /a\.b\.c/);
  assert.doesNotMatch(environmentText, /NODE_OPTIONS/);
  assert.doesNotMatch(environmentText, /NODE_EXTRA_CA_CERTS/);
  assert.doesNotMatch(environmentText, /NODE_TLS_REJECT_UNAUTHORIZED/);

  await Promise.all([
    rm(argumentsFile, { force: true }),
    rm(environmentFile, { force: true }),
    rm(tokenFile, { force: true }),
  ]);
  await writeFile(
    harness,
    `${harnessPrefix}app_jwt() { return 65; }\nexec_task7\n`,
    { mode: 0o700 }
  );
  const failure = spawnSync(harness, [root], { encoding: 'utf8' });
  assert.equal(failure.status, 65);
  await assert.rejects(readFile(argumentsFile), { code: 'ENOENT' });
  await assert.rejects(readFile(environmentFile), { code: 'ENOENT' });
  await assert.rejects(readFile(tokenFile), { code: 'ENOENT' });
});

test('mints a signed short-lived App JWT from sealed owner inputs', async (t) => {
  const source = await readFile(
    path.join(directory, 'verify-owner-cli.sh'),
    'utf8'
  );
  const root = await mkdtemp(path.join(tmpdir(), 'baci-cwv-jwt-test-'));
  t.after(() => rm(root, { force: true, recursive: true }));
  await chmod(root, 0o700);
  const privateKey = path.join(root, 'private-key.pem');
  const generated = spawnSync(
    '/usr/bin/openssl',
    [
      'genpkey',
      '-algorithm',
      'RSA',
      '-pkeyopt',
      'rsa_keygen_bits:2048',
      '-out',
      privateKey,
    ],
    { encoding: 'utf8' }
  );
  assert.equal(generated.status, 0, generated.stderr);
  await chmod(privateKey, 0o600);
  await writeFile(path.join(root, 'auditor-app-id'), '123\n', { mode: 0o400 });
  const executable = path.join(root, 'mint-jwt.sh');
  await writeFile(
    executable,
    `${source.slice(0, source.indexOf('exec_task7() {'))}\nassert_owner_input() { :; }\nroot=$1\napp_jwt\n`,
    { mode: 0o500 }
  );
  const minted = spawnSync(executable, [root], { encoding: 'utf8' });
  assert.equal(minted.status, 0, minted.stderr);
  const [header, payload, signature] = minted.stdout.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url')), {
    alg: 'RS256',
    typ: 'JWT',
  });
  const claims = JSON.parse(Buffer.from(payload, 'base64url'));
  assert.equal(claims.iss, '123');
  assert.equal(claims.exp - claims.iat, 600);
  assert.equal(
    verify(
      'RSA-SHA256',
      Buffer.from(`${header}.${payload}`),
      await readFile(privateKey),
      Buffer.from(signature, 'base64url')
    ),
    true
  );
});

test('only expects a duplicate ref create refusal after ruleset activation', async () => {
  const source = await readFile(
    path.join(directory, 'verify-owner-cli.sh'),
    'utf8'
  );
  const start = source.indexOf('(assert-owned-probe-duplicate-create)');
  const end = source.indexOf('\n    (assert-owned-probe-update|', start);

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const duplicateCreate = source.slice(start, end);
  assert.match(duplicateCreate, /expect_refusal .* "\$ref_request"/);
  assert.doesNotMatch(duplicateCreate, /fresh/);
  assert.equal((duplicateCreate.match(/expect_refusal/g) ?? []).length, 1);

  assert.match(
    source,
    /\(assert-owned-probe-update\|assert-owned-probe-force-update\)[\s\S]*expect_refusal/
  );
  assert.match(source, /\(assert-owned-probe-delete\)[\s\S]*expect_refusal/);
});
