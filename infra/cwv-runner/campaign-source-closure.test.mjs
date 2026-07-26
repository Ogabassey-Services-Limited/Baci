import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  campaignSourceDigest,
  campaignSourceClosure as closure,
} from './campaign-source-closure.mjs';

test('campaign source digest binds relative closure names and reports CLI failures cleanly', async (t) => {
  const parent = await fs.mkdtemp(
    path.join(os.tmpdir(), 'cwv-source-digest-roots-')
  );
  t.after(() => fs.rm(parent, { recursive: true, force: true }));
  const createClosure = async (name) => {
    const root = path.join(parent, name);
    await fs.mkdir(root);
    await Promise.all(
      closure.map((entry) => fs.writeFile(path.join(root, entry), `${entry}\n`))
    );
    return root;
  };
  const [left, right] = await Promise.all([
    createClosure('left'),
    createClosure('right'),
  ]);
  assert.equal(
    await campaignSourceDigest(left),
    await campaignSourceDigest(right)
  );
  await fs.appendFile(path.join(right, closure[0]), 'drift\n');
  assert.notEqual(
    await campaignSourceDigest(left),
    await campaignSourceDigest(right)
  );
  const cli = spawnSync(
    process.execPath,
    [
      new URL('./campaign-source-closure.mjs', import.meta.url).pathname,
      'digest',
      path.join(parent, 'missing'),
    ],
    { encoding: 'utf8' }
  );
  assert.equal(cli.status, 65, cli.stderr);
  assert.match(cli.stderr, /^campaign source digest failed: /);
  assert.doesNotMatch(cli.stderr, /UnhandledPromiseRejection|node:internal/);
});
test('campaign source digest binds quiesce and the reviewed cron inventory', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cwv-source-bound-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await Promise.all(
    closure.map((entry) => fs.writeFile(path.join(root, entry), `${entry}\n`))
  );
  const baseline = await campaignSourceDigest(root);
  for (const name of ['campaign-quiesce.sh', 'cron-inventory.json']) {
    await fs.appendFile(path.join(root, name), 'drift\n');
    assert.notEqual(await campaignSourceDigest(root), baseline, name);
    await fs.writeFile(path.join(root, name), `${name}\n`);
  }
});
test('campaign source digest drift blocks restore and watchdog actions', async (t) => {
  const [watchdog, restore] = await Promise.all([
    fs.readFile(new URL('./campaign-watchdog.sh', import.meta.url), 'utf8'),
    fs.readFile(new URL('./campaign-restore.sh', import.meta.url), 'utf8'),
  ]);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cwv-source-closure-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'source');
  const stateRoot = path.join(root, 'campaigns');
  const bin = path.join(root, 'bin');
  await Promise.all(
    [source, stateRoot, bin].map((directory) => fs.mkdir(directory))
  );
  await fs.chmod(stateRoot, 0o700);

  const id = path.join(bin, 'id');
  const stat = path.join(bin, 'stat');
  const flock = path.join(bin, 'flock');
  const sha256sum = path.join(bin, 'sha256sum');
  const checksumCommand = spawnSync('/bin/sh', ['-c', 'command -v sha256sum'], {
    encoding: 'utf8',
  });
  assert.equal(checksumCommand.status, 0, checksumCommand.stderr);
  const checksumPath = checksumCommand.stdout.trim();
  assert.match(checksumPath, /^\//);
  await Promise.all([
    fs.writeFile(id, '#!/bin/sh\nprintf "0\\n"\n'),
    fs.writeFile(stat, '#!/bin/sh\nprintf "0:700\\n"\n'),
    fs.writeFile(flock, '#!/bin/sh\nexit 0\n'),
    fs.writeFile(sha256sum, `#!/bin/sh\nexec "${checksumPath}" "$@"\n`),
  ]);
  await Promise.all(
    [id, stat, flock, sha256sum].map((file) => fs.chmod(file, 0o755))
  );
  for (const name of closure) {
    await fs.writeFile(path.join(source, name), `// ${name}\n`);
  }
  await fs.writeFile(
    path.join(source, 'campaign-state.mjs'),
    "if (process.argv[2] !== 'verify-capture') process.exit(1); process.stdout.write('registration');\n"
  );
  await fs.writeFile(path.join(source, 'policy.json'), '{}\n');
  const transform = (value) =>
    value
      .replaceAll('/srv/baci-cwv/campaigns', stateRoot)
      .replaceAll('/usr/bin/node', process.execPath)
      .replaceAll('/usr/bin/sha256sum', sha256sum)
      .replaceAll('/usr/bin/id', id)
      .replaceAll('/usr/bin/stat', stat)
      .replaceAll('/usr/bin/flock', flock);
  const restorePath = path.join(source, 'campaign-restore.sh');
  const watchdogPath = path.join(source, 'campaign-watchdog.sh');
  await Promise.all([
    fs.writeFile(restorePath, transform(restore)),
    fs.writeFile(watchdogPath, transform(watchdog)),
  ]);
  await Promise.all(
    [restorePath, watchdogPath].map((file) => fs.chmod(file, 0o755))
  );

  const transactionId = 'policy-schema-drift';
  const transaction = path.join(stateRoot, transactionId);
  await fs.mkdir(transaction);
  await fs.chmod(transaction, 0o700);
  await fs.copyFile(
    new URL('./campaign-source-closure.mjs', import.meta.url),
    path.join(source, 'campaign-source-closure.mjs')
  );
  const sourceDigest = await campaignSourceDigest(source);
  const captureSha = 'a'.repeat(64);
  await fs.writeFile(path.join(transaction, 'capture.sha256'), captureSha);
  await fs.writeFile(
    path.join(transaction, 'watchdog.env'),
    `TRANSACTION_ID=${transactionId}\nMODE=registration\nCAPTURE_SHA=${captureSha}\nSOURCE_DIGEST=${sourceDigest}\nCREATION_BOOT_ID=boot-a\nUTC_DEADLINE=2099-01-01T00:00:00Z\nMONOTONIC_DEADLINE=999999999\n`
  );
  await fs.appendFile(
    path.join(source, 'campaign-state-journal-lock.mjs'),
    '// post-capture drift\n'
  );
  assert.notEqual(await campaignSourceDigest(source), sourceDigest);
  const restoreResult = spawnSync(
    '/bin/sh',
    [restorePath, transactionId, captureSha],
    { encoding: 'utf8' }
  );
  assert.equal(restoreResult.status, 66, restoreResult.stderr);
  assert.match(restoreResult.stderr, /source digest mismatch/);
  const watchdogResult = spawnSync('/bin/sh', [watchdogPath, transactionId], {
    encoding: 'utf8',
  });
  assert.equal(watchdogResult.status, 66, watchdogResult.stderr);
  await assert.rejects(fs.readFile(path.join(transaction, 'restored.json')));
});
