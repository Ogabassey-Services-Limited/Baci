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
    /read-auditor-app-registration\) jwt=\$\(app_jwt\) \|\| refuse; GH_TOKEN=unused-placeholder exec "\$gh" api --method GET -H "Authorization: Bearer \$jwt" -H "X-GitHub-Api-Version: \$API_VERSION" \/app/
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
  const ghDirectory = path.join(root, 'tools', 'gh', 'bin');
  await mkdir(ghDirectory, { recursive: true, mode: 0o700 });
  const argumentsFile = path.join(root, 'arguments');
  const tokenFile = path.join(root, 'gh-token');
  await writeFile(
    path.join(ghDirectory, 'gh'),
    `#!/bin/sh\nprintf '%s\\n' "$GH_TOKEN" > '${tokenFile}'\nprintf '%s\\n' "$@" > '${argumentsFile}'\n`,
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
    `${harnessPrefix}app_jwt() { printf '%s' a.b.c; }\nexec_task7\n`,
    { mode: 0o700 }
  );
  const success = spawnSync(harness, [root], { encoding: 'utf8' });
  assert.equal(success.status, 0, success.stderr);
  assert.equal(await readFile(tokenFile, 'utf8'), 'unused-placeholder\n');
  assert.deepEqual((await readFile(argumentsFile, 'utf8')).trim().split('\n'), [
    'api',
    '--method',
    'GET',
    '-H',
    'Authorization: Bearer a.b.c',
    '-H',
    'X-GitHub-Api-Version: 2026-03-10',
    '/app',
  ]);

  await Promise.all([
    rm(argumentsFile, { force: true }),
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
