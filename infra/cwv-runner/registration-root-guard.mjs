import { createHash } from 'node:crypto';
import { readdir, readFile, readlink } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';

const TOKEN_TARGET = '/run/secrets/runner-registration-token';
const RUNNER = 10001;
const fail = () => {
  throw new TypeError('registration guard refused');
};
const digest = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

function parseStatus(bytes) {
  const text = bytes?.toString('utf8');
  const row = (name) => {
    const value = new RegExp(`^${name}:([^\\r\\n]*)$`, 'm').exec(
      text ?? ''
    )?.[1];
    if (value === undefined) return;
    const normalized = value.trim();
    return normalized ? normalized.split(/\s+/).map(Number) : [];
  };
  const uid = row('Uid');
  const gid = row('Gid');
  const groups = row('Groups');
  if (
    uid?.length !== 4 ||
    gid?.length !== 4 ||
    !groups ||
    [...uid, ...gid, ...groups].some(
      (value) => !Number.isSafeInteger(value) || value < 0
    )
  )
    fail();
  return { gid, groups, uid };
}

function usesRunner(status) {
  return [...status.uid, ...status.gid, ...status.groups].includes(RUNNER);
}

function expectedCredentials(status) {
  return (
    status.uid.every((value) => value === RUNNER) &&
    status.gid.every((value) => value === RUNNER) &&
    isDeepStrictEqual(status.groups, [RUNNER])
  );
}

function cgroupPath(bytes) {
  const rows = bytes?.toString('utf8').trim().split('\n');
  const value = rows?.find((row) => row.startsWith('0::'))?.slice(3);
  if (!value?.startsWith('/')) fail();
  return `/sys/fs/cgroup${value}`;
}

function tokenMountCount(bytes) {
  return bytes
    ?.toString('utf8')
    .split('\n')
    .filter((row) => row.split(' ')[4] === TOKEN_TARGET).length;
}

function absentTokenBoundary(boundary) {
  return new Set([
    'token-absent',
    'before-release-publication',
    'release-consumed',
    'before-exec-verification',
    'after-exec-verification',
    'before-seal',
  ]).has(boundary);
}

const terminalBoundary = (boundary) => boundary === 'before-seal';
const processExited = (error) =>
  error?.code === 'ENOENT' || error?.code === 'ESRCH';

export function createRegistrationExclusiveGuard(
  configuration,
  dependencies = {}
) {
  const list = dependencies.listProc ?? (async () => readdir('/proc'));
  const read = dependencies.readFile ?? readFile;
  const link = dependencies.readlink ?? readlink;
  const dedicated = dependencies.inspectDedicated;
  const defaultDrop = dependencies.defaultDrop;
  const kill = dependencies.kill;
  const every = dependencies.setInterval ?? setInterval;
  const stopEvery = dependencies.clearInterval ?? clearInterval;
  if (
    typeof list !== 'function' ||
    typeof read !== 'function' ||
    typeof link !== 'function' ||
    typeof dedicated !== 'function' ||
    typeof defaultDrop !== 'function' ||
    typeof kill !== 'function' ||
    typeof every !== 'function' ||
    typeof stopEvery !== 'function' ||
    !configuration?.context?.registrationNonce
  )
    fail();
  const name = `baci-cwv-registration-${configuration.context.registrationNonce}`;
  let armed = false;
  let established;
  let sequence = 0;
  let fatal = false;
  let interval;
  let boundary;
  const terminate = async (authority) => {
    try {
      await defaultDrop();
    } finally {
      await kill(authority?.containerId ?? name);
    }
  };
  const refuse = async (authority) => {
    await terminate(authority);
    fail();
  };
  const inspect = async (currentBoundary, authority) => {
    const entries = await list('/proc');
    const pids = entries
      .map((entry) => (typeof entry === 'string' ? entry : entry?.name))
      .filter((entry) => /^\d+$/.test(entry) && Number(entry) > 1)
      .sort((left, right) => Number(left) - Number(right));
    const processes = await Promise.all(
      pids.map(async (pid) => {
        const root = `/proc/${pid}`;
        const observations = await Promise.allSettled([
          read(`${root}/status`),
          read(`${root}/cgroup`),
          read(`${root}/mountinfo`),
          link(`${root}/ns/cgroup`),
          link(`${root}/ns/mnt`),
          link(`${root}/ns/user`),
        ]);
        const refusal = observations.find(
          (result) =>
            result.status === 'rejected' && !processExited(result.reason)
        );
        if (refusal) throw refusal.reason;
        if (observations.some((result) => result.status === 'rejected')) return;
        const [
          status,
          cgroup,
          mountinfo,
          cgroupNamespace,
          mountNamespace,
          userNamespace,
        ] = observations.map((result) => result.value);
        return {
          cgroup: cgroupPath(cgroup),
          cgroupNamespace,
          mountinfo,
          mountNamespace,
          pid: Number(pid),
          status: parseStatus(status),
          userNamespace,
        };
      })
    );
    const runner = processes.filter(
      (process) => process && usesRunner(process.status)
    );
    const inventory = await dedicated();
    if (!Array.isArray(inventory?.containers)) fail();
    if (terminalBoundary(currentBoundary)) {
      if (runner.length || inventory.containers.length) fail();
      return;
    }
    if (!authority) {
      if (runner.length || inventory.containers.length) fail();
      return;
    }
    const process = runner[0];
    const expected = authority.runtimeIdentity;
    if (
      runner.length !== 1 ||
      inventory.containers.length !== 1 ||
      process.pid !== authority.listenerPid ||
      !expectedCredentials(process.status) ||
      process.cgroup !== expected.cgroupPath ||
      process.cgroupNamespace !== authority.cgroupNamespace ||
      process.mountNamespace !== authority.mountNamespace ||
      process.userNamespace !== authority.userNamespace ||
      inventory.containers[0]?.id !== authority.containerId ||
      inventory.containers[0]?.name !== name ||
      inventory.containers[0]?.state !== 'running' ||
      tokenMountCount(process.mountinfo) !==
        (absentTokenBoundary(currentBoundary) ? 0 : 1)
    )
      fail();
  };
  const monitor = () => {
    if (fatal || !armed) return;
    void inspect(boundary, established).catch(async () => {
      fatal = true;
      stopEvery(interval);
      try {
        await terminate(established);
      } catch {
        /* best-effort containment */
      }
    });
  };
  return async (currentBoundary, authority) => {
    if (currentBoundary === 'before-token-parent') {
      armed = true;
      interval = every(monitor, 100);
      interval?.unref?.();
    }
    if (!armed) return refuse(authority);
    if (fatal) return refuse(authority ?? established);
    if (authority) {
      if (established && !isDeepStrictEqual(authority, established))
        return refuse(authority);
      established ??= authority;
    } else if (established) return refuse(established);
    boundary = currentBoundary;
    try {
      await inspect(currentBoundary, established);
      sequence += 1;
      return Object.freeze({
        guardReceiptSha256: digest({
          authority,
          boundary: currentBoundary,
          sequence,
        }),
        guardSequence: sequence,
      });
    } catch {
      return refuse(authority ?? established);
    }
  };
}
