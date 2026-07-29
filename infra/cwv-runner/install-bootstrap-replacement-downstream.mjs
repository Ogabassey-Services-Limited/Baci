import { execFile as execFileCallback } from 'node:child_process';
import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const UNITS = [
  'baci-cwv-containerd.service',
  'baci-cwv-docker.service',
  'baci-cwv-host-sampler.service',
  'baci-cwv-host-sampler.timer',
  'baci-cwv-measurement.service',
];

async function countDirectory(path) {
  const details = await lstat(path);
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

async function systemUnitIsActive(name) {
  try {
    await execFile('/bin/systemctl', ['is-active', '--quiet', name]);
    return true;
  } catch (error) {
    if (error.code === 3) return false;
    throw error;
  }
}

async function systemUnitState(name) {
  const { stdout } = await execFile('/bin/systemctl', [
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

async function systemWatchdogInstances() {
  const outputs = await Promise.all([
    execFile('/bin/systemctl', [
      'list-units',
      'baci-cwv-campaign-watchdog@*.service',
      '--all',
      '--plain',
      '--no-legend',
      '--full',
      '--no-pager',
    ]),
    execFile('/bin/systemctl', [
      'list-unit-files',
      'baci-cwv-campaign-watchdog@*.service',
      '--no-legend',
      '--full',
      '--no-pager',
    ]),
  ]);
  return outputs
    .flatMap(({ stdout }) => stdout.split('\n'))
    .map((line) => line.trim().split(/\s+/)[0])
    .filter((name) => name && name !== 'baci-cwv-campaign-watchdog@.service')
    .length;
}

export async function readBootstrapReplacementDownstream(
  { root, prepareRoot },
  dependencies = {}
) {
  const unitIsActive = dependencies.unitIsActive ?? systemUnitIsActive;
  const readUnitState = dependencies.readUnitState ?? systemUnitState;
  const listWatchdogInstances =
    dependencies.listWatchdogInstances ?? systemWatchdogInstances;
  const active = await Promise.all(UNITS.map(unitIsActive));
  const states = await Promise.all(UNITS.map((name) => readUnitState(name)));
  const templateState = await readUnitState(
    'baci-cwv-campaign-watchdog@.service'
  );
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
      states.filter((state) => state !== 'loaded\ninactive\nstatic\n').length +
      (templateState === 'loaded\ninactive\ndisabled\n' ? 0 : 1),
    watchdogInstances: await listWatchdogInstances(),
  };
}
