import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, lstat, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  captureBootstrap,
  completeBootstrapTransaction,
  journalBootstrap,
  resumeBootstrap,
  verifyBootstrapTransaction,
} from './install-bootstrap-controller.mjs';
import { publishBootstrapPlan } from './install-bootstrap-plan-publication.mjs';

const execFile = promisify(execFileCallback);

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const files = {
  '/etc/baci-cwv/daemon.json': {
    sha256: sha256('daemon'),
    mode: '0644',
    owner: 'root:root',
  },
};
const input = {
  transactionId: 'bootstrap-a',
  sourceSha: 'a'.repeat(40),
  sourceManifestSha256: 'b'.repeat(64),
  policyFileSha256: 'c'.repeat(64),
  prior: { '/etc/baci-cwv/daemon.json': { absent: true } },
  files,
};
const disabledUnits = {
  'baci-cwv-docker.service': 'loaded\ninactive\ndisabled\n',
};

test('drives durable bootstrap capture, journal, completion, and verification', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-bootstrap-control-'));
  context.after(async () =>
    import('node:fs/promises').then(({ rm }) =>
      rm(root, { recursive: true, force: true })
    )
  );
  await chmod(root, 0o700);
  const directory = await captureBootstrap(root, input);
  await journalBootstrap(
    directory,
    'install-file',
    '/etc/baci-cwv/daemon.json',
    files['/etc/baci-cwv/daemon.json'].sha256
  );
  await completeBootstrapTransaction(
    directory,
    disabledUnits,
    async () => files
  );

  const verified = await verifyBootstrapTransaction(
    directory,
    async () => files
  );
  assert.equal(verified.phase, 'complete');
  assert.match(verified.receiptSha256, /^[0-9a-f]{64}$/);
});

test('refuses completion without an exact installed projection', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-bootstrap-refuse-'));
  context.after(async () =>
    import('node:fs/promises').then(({ rm }) =>
      rm(root, { recursive: true, force: true })
    )
  );
  await chmod(root, 0o700);
  const directory = await captureBootstrap(root, input);

  await assert.rejects(
    () =>
      completeBootstrapTransaction(directory, disabledUnits, async () => ({
        '/etc/baci-cwv/daemon.json': {
          ...files['/etc/baci-cwv/daemon.json'],
          sha256: sha256('drift'),
        },
      })),
    /projection/
  );
});

test('does not accept a planned projection when the installed reader disagrees', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-bootstrap-installed-drift-'));
  context.after(async () =>
    import('node:fs/promises').then(({ rm }) =>
      rm(root, { recursive: true, force: true })
    )
  );
  await chmod(root, 0o700);
  const directory = await captureBootstrap(root, input);
  await assert.rejects(
    () =>
      completeBootstrapTransaction(directory, disabledUnits, async () => ({
        '/etc/baci-cwv/daemon.json': {
          ...files['/etc/baci-cwv/daemon.json'],
          mode: '0600',
        },
      })),
    /installed projection mismatch/
  );
});

test('refuses a resume input from another bootstrap transaction', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-bootstrap-transaction-'));
  context.after(async () =>
    import('node:fs/promises').then(({ rm }) =>
      rm(root, { recursive: true, force: true })
    )
  );
  await chmod(root, 0o700);
  const directory = await captureBootstrap(root, input);

  await assert.rejects(
    () =>
      resumeBootstrap(directory, { ...input, transactionId: 'bootstrap-b' }),
    /bootstrap resume authority mismatch/
  );
});

test('inventory command reconciles a receipt-bound published plan without replacement authorization', async (context) => {
  const parent = await mkdtemp(join(tmpdir(), 'baci-bootstrap-inventory-cli-'));
  context.after(() =>
    import('node:fs/promises').then(({ rm }) =>
      rm(parent, { recursive: true, force: true })
    )
  );
  const stateRoot = join(parent, 'bootstrap');
  await import('node:fs/promises').then(({ mkdir }) =>
    mkdir(stateRoot, { mode: 0o700 })
  );
  const exactInput = {
    ...input,
    transactionId: `bootstrap-${input.sourceSha.slice(0, 12)}`,
  };
  await captureBootstrap(stateRoot, exactInput);
  const plan = await publishBootstrapPlan(
    parent,
    Buffer.from(`${JSON.stringify(exactInput)}\n`)
  );

  const result = await execFile(process.execPath, [
    fileURLToPath(
      new URL('./install-bootstrap-controller.mjs', import.meta.url)
    ),
    'replacement-inventory',
    stateRoot,
  ]);

  assert.deepEqual(JSON.parse(result.stdout), [exactInput.transactionId]);
  await assert.rejects(lstat(plan), { code: 'ENOENT' });
});

test('reports the supplied unsupported controller command', async () => {
  await assert.rejects(
    execFile(process.execPath, [
      fileURLToPath(
        new URL('./install-bootstrap-controller.mjs', import.meta.url)
      ),
      'unsupported-command',
      'first',
      'second',
      'third',
      'fourth',
      'fifth',
    ]),
    (error) =>
      error.code === 1 &&
      /unsupported bootstrap controller command: unsupported-command/.test(
        error.stderr
      )
  );
});
