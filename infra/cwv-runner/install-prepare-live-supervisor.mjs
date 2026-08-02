import { execFile as execFileCallback } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  readlink,
  rename,
  statfs,
} from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { runPrepareSupervisor } from './install-prepare-supervisor.mjs';

const execFile = promisify(execFileCallback);
const HEX = /^[0-9a-f]{64}$/;
const TRANSACTION = /^prepare-[a-z0-9][a-z0-9-]{0,52}$/;
const CONTROL = /^0::\/cwv-measurement-control\.slice(?:\/[A-Za-z0-9_.@:-]+)*$/;
const DEDICATED_ARGUMENT =
  /(?:\/etc\/baci-cwv\/(?:daemon\.json|containerd\.toml)|\/run\/baci-cwv\/docker\.sock)/;
const PREPARE_SAMPLE_SECONDS = 2;
const SYSTEMD_PROPERTIES =
  'Id,ActiveState,SubState,MainPID,ControlGroup,AllowedCPUs';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const command = async (file, args = []) =>
  (
    await execFile(file, args, {
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
      timeout: 1500,
    })
  ).stdout.trim();

export const normalizeFirewall = (value) =>
  value
    .replaceAll(/counter packets \d+ bytes \d+/g, 'counter packets # bytes #')
    .trim();

export function parsePsiFullAvg10(value) {
  const match = /^full\s+.*\bavg10=(\d+(?:\.\d+)?)\b/m.exec(value);
  if (!match) throw new Error('complete pressure sample required');
  return Number(match[1]);
}

export function assertDedicatedProcessPlacement(processes) {
  for (const row of processes) {
    if (DEDICATED_ARGUMENT.test(row.command) && !CONTROL.test(row.cgroup))
      throw new Error(`dedicated process outside control slice: ${row.pid}`);
  }
}

export async function atomicJson(path, value, operations = {}) {
  const openFile = operations.openFile ?? open;
  const randomId = operations.randomId ?? randomUUID;
  const renameFile = operations.renameFile ?? rename;
  const directory = path.slice(0, path.lastIndexOf('/'));
  let temporary;
  let handle;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    temporary = join(directory, `.${randomId()}.tmp`);
    try {
      handle = await openFile(temporary, 'wx', 0o600);
      break;
    } catch (error) {
      if (error.code !== 'EEXIST' || attempt === 2) throw error;
    }
  }
  await handle
    .writeFile(`${JSON.stringify(value)}\n`)
    .then(() => handle.sync())
    .finally(() => handle.close());
  await renameFile(temporary, path);
  const parent = await openFile(directory, 'r');
  await parent.sync().finally(() => parent.close());
}

async function optionalIdentity(path) {
  try {
    const value = await lstat(path);
    if (value.isSymbolicLink()) throw new Error('production identity symlink');
    return { path, dev: value.dev, ino: value.ino, mode: value.mode & 0o777 };
  } catch (error) {
    if (error.code === 'ENOENT') return { path, absent: true };
    throw error;
  }
}

async function systemdIdentity(capture) {
  const units = new Set(
    'cron docker containerd'.split(' ').map((unit) => `${unit}.service`)
  );
  for (const key of ['runners', 'timers', 'slices'])
    for (const row of capture.priorState.resources[key]) units.add(row.id);
  const rows = [];
  for (const unit of [...units].sort()) {
    if (!/^[A-Za-z0-9_.@-]+$/.test(unit))
      throw new Error('unsafe captured unit');
    rows.push(
      await command('/bin/systemctl', [
        'show',
        unit,
        `--property=${SYSTEMD_PROPERTIES}`,
      ])
    );
  }
  return rows;
}

async function processInventory() {
  const rows = [];
  for (const name of await readdir('/proc')) {
    if (!/^\d+$/.test(name)) continue;
    try {
      const [cgroup, executable, argv] = await Promise.all([
        readFile(`/proc/${name}/cgroup`, 'utf8'),
        readlink(`/proc/${name}/exe`),
        readFile(`/proc/${name}/cmdline`),
      ]);
      rows.push({
        pid: Number(name),
        executable,
        cgroup: cgroup.trim(),
        command: argv.toString('utf8').replaceAll('\0', ' ').trim(),
      });
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'EACCES') throw error;
    }
  }
  assertDedicatedProcessPlacement(rows);
  return rows;
}

function containerIdentity(capture, processes) {
  return capture.priorState.resources.containers.map((container) => {
    if (!/^[a-f0-9]{12,64}$/.test(container.id))
      throw new Error('unsafe container id');
    const cgroups = Array.from(
      new Set(
        processes
          .map((row) => row.cgroup)
          .filter((cgroup) => cgroup.includes(container.id))
      )
    ).sort();
    if (container.running && cgroups.length === 0)
      throw new Error(`production container absent: ${container.id}`);
    return { id: container.id, running: container.running, cgroups };
  });
}

async function firewallIdentity() {
  const outputs = await Promise.all([
    command('/usr/sbin/iptables', ['-S']),
    command('/usr/sbin/ip6tables', ['-S']),
    command('/usr/sbin/nft', ['--stateless', 'list', 'ruleset']),
    command('/usr/sbin/ip', ['-json', '-4', 'rule', 'show']),
    command('/usr/sbin/ip', ['-json', '-6', 'rule', 'show']),
    command('/usr/sbin/ip', ['-json', 'address', 'show']),
    command('/usr/sbin/ip', ['-json', 'route', 'show', 'table', 'all']),
  ]);
  return sha256(outputs.map(normalizeFirewall).join('\n--\n'));
}

async function snapshot(capture) {
  const processes = await processInventory();
  const [units, containers, firewall, files] = await Promise.all([
    systemdIdentity(capture),
    containerIdentity(capture, processes),
    firewallIdentity(),
    Promise.all(
      '/var/run/docker.sock /run/containerd/containerd.sock /var/lib/docker /var/lib/containerd'
        .split(' ')
        .map(optionalIdentity)
    ),
  ]);
  return {
    production: sha256(
      JSON.stringify({
        bootId: capture.host.bootId,
        units,
        containers,
        files,
      })
    ),
    firewall,
    workers: processes
      .filter((row) => CONTROL.test(row.cgroup))
      .map(({ pid, executable, cgroup }) => ({ pid, executable, cgroup })),
  };
}

async function resourceObservation() {
  const [memory, root, cpu, memoryPsi, io] = await Promise.all([
    readFile('/proc/meminfo', 'utf8'),
    statfs('/'),
    readFile('/proc/pressure/cpu', 'utf8'),
    readFile('/proc/pressure/memory', 'utf8'),
    readFile('/proc/pressure/io', 'utf8'),
  ]);
  const available = /^MemAvailable:\s+(\d+)\s+kB$/m.exec(memory);
  if (!available) throw new Error('available memory sample required');
  return {
    availableMemoryBytes: Number(available[1]) * 1024,
    rootFreeBytes: Number(root.bavail * root.bsize),
    psi: {
      cpu: parsePsiFullAvg10(cpu),
      memory: parsePsiFullAvg10(memoryPsi),
      io: parsePsiFullAvg10(io),
    },
  };
}

function thresholds(policy) {
  return {
    availableMemoryBytesMin: policy.thresholds.availableMemoryBytesMin,
    rootFreeBytesMin: policy.thresholds.rootFreeBytesMin,
    cpuPsiFullAvg10Max: policy.thresholds.cpuPsiFullAvg10Max,
    memoryPsiFullAvg10Max: policy.thresholds.memoryPsiFullAvg10Max,
    ioPsiFullAvg10Max: policy.thresholds.ioPsiFullAvg10Max,
  };
}

export async function watchPrepare(
  transaction,
  capturePath,
  captureSha,
  policyPath,
  directory,
  operations = {}
) {
  const writeJson = operations.atomicJson ?? atomicJson;
  const createDirectory = operations.mkdir ?? mkdir;
  const read = operations.readFile ?? readFile;
  const takeSnapshot = operations.snapshot ?? snapshot;
  if (!TRANSACTION.test(transaction) || !HEX.test(captureSha))
    throw new TypeError('invalid live supervisor identity');
  await createDirectory(directory, { recursive: false, mode: 0o700 });
  const [captureBytes, policy] = await Promise.all([
    read(capturePath),
    read(policyPath, 'utf8').then(JSON.parse),
  ]);
  if (sha256(captureBytes) !== captureSha)
    throw new Error('capture digest mismatch');
  if (policy?.installationImport?.sampleSeconds !== PREPARE_SAMPLE_SECONDS)
    throw new Error('prepare sample interval drift');
  const capture = JSON.parse(captureBytes);
  const initial = await takeSnapshot(capture);
  if (initial.workers.length !== 0)
    throw new Error('dedicated workers present before prepare');
  const baseline = {
    campaignCaptureSha256: captureSha,
    productionIdentitySha256: initial.production,
    firewallIdentitySha256: initial.firewall,
    dedicatedSocket: '/run/baci-cwv/docker.sock',
    sampleSeconds: PREPARE_SAMPLE_SECONDS,
    thresholds: thresholds(policy),
  };
  await writeJson(join(directory, 'supervisor-ready.json'), baseline);
  let collectionMilliseconds = 0;
  const receipt = await runPrepareSupervisor({
    baseline,
    collect: async () => {
      const started = Date.now();
      const current = await takeSnapshot(capture);
      const resources = await resourceObservation();
      collectionMilliseconds = Date.now() - started;
      const observation = {
        elapsedMilliseconds: collectionMilliseconds,
        campaignCaptureSha256: captureSha,
        productionIdentitySha256: current.production,
        firewallIdentitySha256: current.firewall,
        dedicatedSocket: '/run/baci-cwv/docker.sock',
        ...resources,
        workers: current.workers,
      };
      await writeJson(join(directory, 'supervisor-sample.json'), observation);
      return observation;
    },
    sleep: (milliseconds) =>
      new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, milliseconds - collectionMilliseconds))
      ),
    shouldStop: async () => {
      try {
        await lstat(join(directory, 'supervisor-stop'));
        return true;
      } catch (error) {
        if (error.code === 'ENOENT') return false;
        throw error;
      }
    },
  });
  await writeJson(join(directory, 'supervisor-receipt.json'), receipt);
  return receipt;
}

export async function requestSupervisorStop(directory) {
  await atomicJson(join(directory, 'supervisor-stop'), { schemaVersion: 1 });
}
