import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import { open } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const source = new URL('./campaign-lease-holder.sh', import.meta.url);
const quiesce = new URL('./campaign-quiesce.sh', import.meta.url);
const read = (url) => fs.readFile(url, 'utf8');
const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitFor(file, attempts = 3000) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return JSON.parse(await fs.readFile(file, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await sleep(10);
    }
  }
  throw new Error('lease holder did not publish its receipt');
}

test('campaign lease remains exclusive until terminal release', async (t) => {
  if (process.platform !== 'linux') {
    t.skip('flock contract executes on Linux');
    return;
  }
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cwv-campaign-lease-'));
  t.after(() => fs.rm(root, { force: true, recursive: true }));
  const campaigns = path.join(root, 'campaigns');
  const transaction = path.join(campaigns, 'registration-01');
  const lock = path.join(root, 'campaign.lock');
  await fs.mkdir(transaction, { recursive: true });
  await fs.chmod(campaigns, 0o700);
  await fs.chmod(transaction, 0o700);
  const holder = path.join(root, 'campaign-lease-holder.sh');
  const body = (await read(source))
    .replace('/srv/baci-cwv/campaigns', campaigns)
    .replace('/run/lock/baci-cwv-campaign.lock', lock)
    .replace('= 0:700 ] || exit 65', `= ${process.getuid()}:700 ] || exit 65`)
    .replace('= 0:600 ] || exit 65', `= ${process.getuid()}:600 ] || exit 65`);
  await fs.writeFile(holder, body, { mode: 0o755 });

  const descriptor = await open(lock, 'a');
  let descriptorClosed = false;
  const closeDescriptor = async () => {
    if (descriptorClosed) return;
    descriptorClosed = true;
    await descriptor.close();
  };
  const token = 'b'.repeat(64);
  const child = spawn(
    '/bin/sh',
    [holder, 'registration-01', 'a'.repeat(64), 'registration', token],
    {
      stdio: [
        'ignore',
        'ignore',
        'inherit',
        'ignore',
        'ignore',
        'ignore',
        'ignore',
        'ignore',
        'ignore',
        descriptor.fd,
      ],
    }
  );
  t.after(async () => {
    child.kill('SIGKILL');
    await closeDescriptor().catch(() => undefined);
  });
  const receipt = await waitFor(path.join(transaction, 'lease-holder.json'));
  await closeDescriptor();
  assert.equal(receipt.lockHeld, true);
  assert.equal(
    spawnSync('/usr/bin/flock', ['-n', lock, '/bin/true']).status,
    1
  );

  await fs.writeFile(
    path.join(transaction, 'lease-release.json'),
    JSON.stringify({
      schemaVersion: 1,
      token,
      transactionId: 'registration-01',
    })
  );
  await fs.chmod(path.join(transaction, 'lease-release.json'), 0o600);
  assert.equal(await new Promise((resolve) => child.once('exit', resolve)), 0);
  assert.equal(
    spawnSync('/usr/bin/flock', ['-n', lock, '/bin/true']).status,
    0
  );
});

test('quiesce transfers the open campaign flock to the terminal lease holder', async () => {
  const body = await read(quiesce);
  assert.doesNotMatch(body, /exec 9>&-/);
  assert.match(
    body,
    /"\$LEASE_HOLDER" "\$transaction_id" "\$capture_sha" "\$mode" "\$lease_token" & lease_holder_pid=\$!/
  );
  assert.match(body, /watchdog lease is not continuously exclusive/);
});
