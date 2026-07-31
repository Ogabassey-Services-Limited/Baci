import assert from 'node:assert/strict';
import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { readBootstrapReplacementDownstream } from './install-bootstrap-replacement-downstream.mjs';

async function temporary(context, prefix) {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  context.after(async () =>
    import('node:fs/promises').then(({ rm }) =>
      rm(directory, { recursive: true, force: true })
    )
  );
  return directory;
}

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
    readUnitState: async () => 'loaded\ninactive\nstatic\n',
    templateIsDisabledOrAbsent: async () => true,
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
    readUnitState: async () => 'loaded\ninactive\nstatic\n',
    templateIsDisabledOrAbsent: async () => true,
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
    {
      runSystemctl,
      templateIsDisabledOrAbsent: async () => true,
      listWatchdogInstances: async () => 0,
    }
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
      templateIsDisabledOrAbsent: async () => false,
      listWatchdogInstances: async () => 0,
    }
  );
  assert.equal(active.activeDedicatedUnits, 7);
  assert.equal(active.unsafeUnitStates, 8);
});

test('inventories both measurement slices for activity and exact static state', async (context) => {
  const root = await temporary(context, 'baci-bootstrap-slice-units-');
  const activeQueries = [];
  const stateQueries = [];
  let templateQueries = 0;
  const dedicatedUnits = [
    'baci-cwv-containerd.service',
    'baci-cwv-docker.service',
    'baci-cwv-host-sampler.service',
    'baci-cwv-host-sampler.timer',
    'baci-cwv-measurement.service',
    'cwv-measurement-control.slice',
    'cwv-measurement.slice',
  ];
  const downstream = await readBootstrapReplacementDownstream(
    { root, prepareRoot: join(root, 'prepare') },
    {
      unitIsActive: (name) => {
        activeQueries.push(name);
        return false;
      },
      readUnitState: (name) => {
        stateQueries.push(name);
        return 'loaded\ninactive\nstatic\n';
      },
      templateIsDisabledOrAbsent: () => {
        templateQueries += 1;
        return true;
      },
      listWatchdogInstances: async () => 0,
    }
  );

  assert.deepEqual(activeQueries.sort(), dedicatedUnits.sort());
  assert.deepEqual(stateQueries.sort(), dedicatedUnits.sort());
  assert.equal(templateQueries, 1);
  assert.equal(downstream.activeDedicatedUnits, 0);
  assert.equal(downstream.unsafeUnitStates, 0);
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
    readUnitState: async () => 'loaded\ninactive\nstatic\n',
    templateIsDisabledOrAbsent: async () => true,
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
