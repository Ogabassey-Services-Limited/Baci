import { execFile as execFileCallback } from 'node:child_process';
import { lstat, readdir, readlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const UNITS = [
  'baci-cwv-containerd.service',
  'baci-cwv-docker.service',
  'baci-cwv-host-sampler.service',
  'baci-cwv-host-sampler.timer',
  'baci-cwv-measurement.service',
  'cwv-measurement-control.slice',
  'cwv-measurement.slice',
];
const SYSTEMD_ROOTS = ['/etc/systemd/system', '/run/systemd/system'];
const WATCHDOG_TEMPLATE = 'baci-cwv-campaign-watchdog@.service';
const WATCHDOG_INSTANCE = /^baci-cwv-campaign-watchdog@[^/@\s]+\.service$/;
const ABSENT_UNIT_STATE = 'not-found\ninactive\n\n';

async function countDirectory(path) {
  let details;
  try {
    details = await lstat(path);
  } catch (error) {
    if (error.code === 'ENOENT') return 0;
    throw error;
  }
  if (!details.isDirectory() || details.isSymbolicLink())
    throw new TypeError(`unsafe bootstrap replacement directory: ${path}`);
  return (await readdir(path)).length;
}

async function exists(path) {
  try {
    await lstat(path);
    return 1;
  } catch (error) {
    if (error.code === 'ENOENT') return 0;
    throw error;
  }
}

async function systemUnitIsActive(name, runSystemctl = execFile) {
  try {
    await runSystemctl('/bin/systemctl', ['is-active', '--quiet', name]);
    return true;
  } catch (error) {
    if (error.code === 3 || error.code === 4) return false;
    throw error;
  }
}

async function systemUnitState(name, runSystemctl = execFile) {
  const { stdout } = await runSystemctl('/bin/systemctl', [
    'show',
    name,
    '--property=LoadState',
    '--property=ActiveState',
    '--property=UnitFileState',
    '--value',
    '--no-pager',
  ]);
  return stdout;
}

async function systemWatchdogTemplateIsDisabledOrAbsent(
  runSystemctl = execFile
) {
  try {
    await runSystemctl('/bin/systemctl', ['is-enabled', WATCHDOG_TEMPLATE]);
    return false;
  } catch (error) {
    if (
      (error.code === 1 && error.stdout === 'disabled\n') ||
      (error.code === 4 && error.stdout === 'not-found\n')
    )
      return true;
    throw error;
  }
}

async function watchdogWantsLinks(systemdRoots) {
  const [persistentRoot] = systemdRoots;
  let count = 0;
  for (const root of systemdRoots) {
    let rootDetails;
    try {
      rootDetails = await lstat(root);
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    if (!rootDetails.isDirectory() || rootDetails.isSymbolicLink())
      throw new TypeError(`unsafe systemd inventory root: ${root}`);
    const rootEntries = await readdir(root, { withFileTypes: true });
    for (const entry of rootEntries.filter(({ name }) =>
      name.endsWith('.wants')
    )) {
      const wants = join(root, entry.name);
      const wantsDetails = await lstat(wants);
      if (!wantsDetails.isDirectory() || wantsDetails.isSymbolicLink())
        throw new TypeError(`unsafe systemd wants directory: ${wants}`);
      for (const candidate of await readdir(wants, { withFileTypes: true })) {
        if (!WATCHDOG_INSTANCE.test(candidate.name)) continue;
        const link = join(wants, candidate.name);
        if (!candidate.isSymbolicLink())
          throw new TypeError(`unsafe watchdog instance link: ${link}`);
        const target = resolve(dirname(link), await readlink(link));
        const allowedTargets = new Set([
          join(root, WATCHDOG_TEMPLATE),
          join(persistentRoot, WATCHDOG_TEMPLATE),
        ]);
        if (!allowedTargets.has(target))
          throw new TypeError(`unsafe watchdog instance link: ${link}`);
        count += 1;
      }
    }
  }
  return count;
}

async function systemWatchdogInstances(
  runSystemctl = execFile,
  systemdRoots = SYSTEMD_ROOTS
) {
  const outputs = await Promise.all([
    runSystemctl('/bin/systemctl', [
      'list-units',
      'baci-cwv-campaign-watchdog@*.service',
      '--all',
      '--plain',
      '--no-legend',
      '--full',
      '--no-pager',
    ]),
    runSystemctl('/bin/systemctl', [
      'list-unit-files',
      'baci-cwv-campaign-watchdog@*.service',
      '--no-legend',
      '--full',
      '--no-pager',
    ]),
  ]);
  const systemdCount = outputs
    .flatMap(({ stdout }) => stdout.split('\n'))
    .map((line) => line.trim().split(/\s+/)[0])
    .filter(
      (name) => name && name !== 'baci-cwv-campaign-watchdog@.service'
    ).length;
  return systemdCount + (await watchdogWantsLinks(systemdRoots));
}

export async function readBootstrapReplacementDownstream(
  { root, prepareRoot },
  dependencies = {}
) {
  const runSystemctl = dependencies.runSystemctl ?? execFile;
  const unitIsActive =
    dependencies.unitIsActive ??
    ((name) => systemUnitIsActive(name, runSystemctl));
  const readUnitState =
    dependencies.readUnitState ??
    ((name) => systemUnitState(name, runSystemctl));
  const templateIsDisabledOrAbsent =
    dependencies.templateIsDisabledOrAbsent ??
    (() => systemWatchdogTemplateIsDisabledOrAbsent(runSystemctl));
  const listWatchdogInstances =
    dependencies.listWatchdogInstances ??
    (() =>
      systemWatchdogInstances(
        runSystemctl,
        dependencies.systemdRoots ?? SYSTEMD_ROOTS
      ));
  const active = await Promise.all(UNITS.map(unitIsActive));
  const states = await Promise.all(UNITS.map((name) => readUnitState(name)));
  const templateDisabledOrAbsent = await templateIsDisabledOrAbsent();
  const acceptedImageFiles = await Promise.all(
    [
      'image-id',
      'image-id.sha256',
      'image-receipt.json',
      'image-receipt.sha256',
    ].map((name) => exists(join(root, name)))
  );
  return {
    acceptedImageFiles: acceptedImageFiles.reduce(
      (total, value) => total + value,
      0
    ),
    activeDedicatedUnits: active.filter(Boolean).length,
    prepareTransactions: await countDirectory(prepareRoot),
    registrationArtifacts:
      (await countDirectory(join(root, 'receipts'))) +
      (await countDirectory(join(root, 'registration-staging'))),
    runnerConfigurationFiles: await countDirectory(
      join(root, 'sealed/actions-runner')
    ),
    unsafeUnitStates:
      states.filter(
        (state) =>
          state !== 'loaded\ninactive\nstatic\n' && state !== ABSENT_UNIT_STATE
      ).length + (templateDisabledOrAbsent ? 0 : 1),
    watchdogInstances: await listWatchdogInstances(),
  };
}
