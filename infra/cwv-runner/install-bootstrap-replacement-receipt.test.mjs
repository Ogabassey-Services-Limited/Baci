import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readFile,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { readBootstrapReplacementDownstream } from './install-bootstrap-replacement-downstream.mjs';
import {
  persistBootstrapReplacementIntent,
  persistBootstrapReplacementReceipt,
  readBootstrapReplacementReceipt,
} from './install-bootstrap-replacement-receipt.mjs';

const oldSource = 'a'.repeat(40);
const newSource = 'b'.repeat(40);
const intent = {
  schemaVersion: 1,
  baselineKind: 'complete',
  baselineSourceSha: oldSource,
  baselineStateSha256: '5'.repeat(64),
  sourceSha: newSource,
  captureSha256: '6'.repeat(64),
  installedProjectionSha256: '7'.repeat(64),
  pathSetSha256: '8'.repeat(64),
  policyFileSha256: '9'.repeat(64),
  authorityChain: [
    {
      journalTipSha256: '1'.repeat(64),
      sealReceiptSha256: '2'.repeat(64),
      sourceSha: oldSource,
      stateSha256: '3'.repeat(64),
    },
    {
      journalTipSha256: '4'.repeat(64),
      sealReceiptSha256: '5'.repeat(64),
      sourceSha: newSource,
      stateSha256: '6'.repeat(64),
    },
  ],
  transitionPaths: ['/srv/baci-cwv/sealed/bootstrap.sha256'],
};

async function temporary(context, prefix) {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  context.after(async () =>
    import('node:fs/promises').then(({ rm }) =>
      rm(directory, { recursive: true, force: true })
    )
  );
  return directory;
}

test('resumes an interrupted intent digest write without changing value bytes', async (context) => {
  const directory = await temporary(context, 'baci-bootstrap-intent-');
  await assert.rejects(
    persistBootstrapReplacementIntent(directory, intent, {
      afterValue: () => {
        throw new Error('crash after replacement intent');
      },
    }),
    /crash after replacement intent/
  );
  const before = await readFile(
    join(directory, 'replacement-intent.json'),
    'utf8'
  );
  await persistBootstrapReplacementIntent(directory, intent);
  assert.equal(
    await readFile(join(directory, 'replacement-intent.json'), 'utf8'),
    before
  );
  assert.match(
    await readFile(join(directory, 'replacement-intent.sha256'), 'utf8'),
    /^[a-f0-9]{64}\n$/
  );
});

test('persists replacement receipts at mode 0600 under a restrictive umask', async (context) => {
  const directory = await temporary(context, 'baci-bootstrap-mode-');
  const previousUmask = process.umask(0o277);
  try {
    await persistBootstrapReplacementIntent(directory, intent);
  } finally {
    process.umask(previousUmask);
  }
  assert.equal(
    (await stat(join(directory, 'replacement-intent.json'))).mode & 0o777,
    0o600
  );
  assert.equal(
    (await stat(join(directory, 'replacement-intent.sha256'))).mode & 0o777,
    0o600
  );
});

test('resumes an interrupted receipt and refuses value drift', async (context) => {
  const directory = await temporary(context, 'baci-bootstrap-receipt-');
  const receipt = { ...intent, receiptSha256: 'a'.repeat(64) };
  await assert.rejects(
    persistBootstrapReplacementReceipt(directory, receipt, {
      afterValue: () => {
        throw new Error('crash after replacement receipt');
      },
    }),
    /crash after replacement receipt/
  );
  await assert.rejects(
    readBootstrapReplacementReceipt(directory),
    /ENOENT|replacement-receipt/
  );
  await persistBootstrapReplacementReceipt(directory, receipt);
  assert.deepEqual(await readBootstrapReplacementReceipt(directory), receipt);
  await persistBootstrapReplacementReceipt(directory, receipt);
  await assert.rejects(
    persistBootstrapReplacementReceipt(directory, {
      ...receipt,
      receiptSha256: 'b'.repeat(64),
    }),
    /replacement receipt drift/
  );
});

test('reads the fixed downstream boundary and detects accepted-image residue', async (context) => {
  const root = await temporary(context, 'baci-bootstrap-downstream-');
  const prepareRoot = join(root, 'prepare');
  for (const path of [
    prepareRoot,
    join(root, 'receipts'),
    join(root, 'registration-staging'),
    join(root, 'sealed/actions-runner'),
  ])
    await mkdir(path, { recursive: true });
  const dependencies = {
    unitIsActive: async () => false,
    readUnitState: async (name) =>
      name.includes('@')
        ? 'loaded\ninactive\ndisabled\n'
        : 'loaded\ninactive\nstatic\n',
    listWatchdogInstances: async () => 0,
  };
  const inert = await readBootstrapReplacementDownstream(
    { root, prepareRoot },
    dependencies
  );
  assert.deepEqual(inert, {
    acceptedImageFiles: 0,
    activeDedicatedUnits: 0,
    prepareTransactions: 0,
    registrationArtifacts: 0,
    runnerConfigurationFiles: 0,
    unsafeUnitStates: 0,
    watchdogInstances: 0,
  });
  await writeFile(join(root, 'image-id'), 'sha256:old\n');
  assert.equal(
    (
      await readBootstrapReplacementDownstream(
        { root, prepareRoot },
        dependencies
      )
    ).acceptedImageFiles,
    1
  );
});

test('treats absent downstream directories as empty before layout creation', async (context) => {
  const root = await temporary(context, 'baci-bootstrap-empty-downstream-');
  const dependencies = {
    unitIsActive: async () => false,
    readUnitState: async (name) =>
      name.includes('@')
        ? 'loaded\ninactive\ndisabled\n'
        : 'loaded\ninactive\nstatic\n',
    listWatchdogInstances: async () => 0,
  };

  assert.deepEqual(
    await readBootstrapReplacementDownstream(
      { root, prepareRoot: join(root, 'prepare') },
      dependencies
    ),
    {
      acceptedImageFiles: 0,
      activeDedicatedUnits: 0,
      prepareTransactions: 0,
      registrationArtifacts: 0,
      runnerConfigurationFiles: 0,
      unsafeUnitStates: 0,
      watchdogInstances: 0,
    }
  );
});

test('accepts only proven-absent never-installed dedicated units', async (context) => {
  const root = await temporary(context, 'baci-bootstrap-absent-units-');
  const runSystemctl = (_command, arguments_) => {
    if (arguments_[0] === 'is-active') {
      throw Object.assign(new Error('unknown unit'), { code: 4 });
    }
    assert.equal(arguments_[0], 'show');
    return { stdout: 'not-found\ninactive\n\n' };
  };
  const downstream = await readBootstrapReplacementDownstream(
    { root, prepareRoot: join(root, 'prepare') },
    { runSystemctl, listWatchdogInstances: async () => 0 }
  );

  assert.equal(downstream.activeDedicatedUnits, 0);
  assert.equal(downstream.unsafeUnitStates, 0);

  const active = await readBootstrapReplacementDownstream(
    { root, prepareRoot: join(root, 'prepare') },
    {
      runSystemctl: (_command, arguments_) => {
        if (arguments_[0] === 'is-active') return { stdout: '' };
        return { stdout: 'loaded\nactive\nenabled\n' };
      },
      listWatchdogInstances: async () => 0,
    }
  );
  assert.equal(active.activeDedicatedUnits, 5);
  assert.equal(active.unsafeUnitStates, 6);
});

test('inventories validated persistent and runtime watchdog wants links', async (context) => {
  const root = await temporary(context, 'baci-bootstrap-watchdog-links-');
  const persistent = join(root, 'etc-systemd');
  const runtime = join(root, 'run-systemd');
  const persistentWants = join(persistent, 'multi-user.target.wants');
  const runtimeWants = join(runtime, 'multi-user.target.wants');
  const template = join(persistent, 'baci-cwv-campaign-watchdog@.service');
  await Promise.all([
    mkdir(persistentWants, { recursive: true }),
    mkdir(runtimeWants, { recursive: true }),
  ]);
  await writeFile(template, 'fixture');
  await Promise.all([
    symlink(
      '../baci-cwv-campaign-watchdog@.service',
      join(persistentWants, 'baci-cwv-campaign-watchdog@persistent.service')
    ),
    symlink(
      template,
      join(runtimeWants, 'baci-cwv-campaign-watchdog@runtime.service')
    ),
  ]);
  const dependencies = {
    unitIsActive: async () => false,
    readUnitState: async (name) =>
      name.includes('@')
        ? 'loaded\ninactive\ndisabled\n'
        : 'loaded\ninactive\nstatic\n',
    runSystemctl: async () => ({ stdout: '' }),
    systemdRoots: [persistent, runtime],
  };

  assert.equal(
    (
      await readBootstrapReplacementDownstream(
        { root, prepareRoot: join(root, 'prepare') },
        dependencies
      )
    ).watchdogInstances,
    2
  );

  await writeFile(join(persistent, 'wrong.service'), 'wrong');
  const invalid = join(
    persistentWants,
    'baci-cwv-campaign-watchdog@invalid.service'
  );
  await symlink('../wrong.service', invalid);
  await assert.rejects(
    readBootstrapReplacementDownstream(
      { root, prepareRoot: join(root, 'prepare') },
      dependencies
    ),
    /unsafe watchdog instance link/
  );
});
