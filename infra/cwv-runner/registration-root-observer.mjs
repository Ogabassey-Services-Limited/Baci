import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile, readlink } from 'node:fs/promises';
import { isDeepStrictEqual, promisify } from 'node:util';
import { registrationLayout } from './registration-controller.mjs';
import { verifyRegistrationTokenMount } from './registration-root-mount-namespace.mjs';
import { collectRegistrationLiveProcessEvidence } from './registration-root-observer-live.mjs';

const execFile = promisify(execFileCallback);
const DOCKER = '/usr/bin/docker';
const SYSTEMCTL = '/bin/systemctl';
const OPTIONS = Object.freeze({
  env: Object.freeze({
    LC_ALL: 'C.UTF-8',
    PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    TZ: 'Etc/UTC',
  }),
  maxBuffer: 1_048_576,
});
const fail = () => {
  throw new TypeError('registration inspection refused');
};
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const expectedArtifacts = (phase, layout) =>
  ({
    'listener-configure': [
      layout.staging,
      layout.releaseParent,
      layout.handoff,
    ],
    'node-ready': Object.values(layout),
    'node-started': Object.values(layout),
    'node-token-absent': [layout.staging, layout.releaseParent, layout.handoff],
    'post-container': [layout.staging, layout.releaseParent, layout.handoff],
    'pre-start': [],
  })[phase];

function expectedMounts(layout) {
  // biome-ignore format: fixed mount projection is clearer as one row per mount
  return Object.freeze([
    { name: 'policy', readOnly: true, source: '/srv/baci-cwv/sealed/policy.sha256', target: '/run/baci-cwv-policy/policy.sha256' },
    { name: 'release', readOnly: true, source: layout.handoff.path, target: '/run/baci-cwv-registration-release' },
    { name: 'staging', readOnly: false, source: layout.staging.path, target: '/registration-staging' },
    { name: 'token', readOnly: true, source: layout.token.path, target: '/run/secrets/runner-registration-token' },
  ]);
}
function parseStatus(text) {
  const line = (name) =>
    new RegExp(`^${name}:\\s+(.+)$`, 'm').exec(text)?.[1].trim();
  const ids = (name) => line(name)?.split(/\s+/).map(Number);
  const uid = ids('Uid');
  const gid = ids('Gid');
  const groups = line('Groups')?.split(/\s+/).filter(Boolean).map(Number);
  const nspid = ids('NSpid');
  if (
    !uid ||
    !gid ||
    !groups ||
    !nspid ||
    uid.length !== 4 ||
    gid.length !== 4 ||
    [...uid, ...gid, ...groups, ...nspid].some(
      (value) => !Number.isSafeInteger(value)
    )
  )
    fail();
  return {
    containerPid: nspid.at(-1),
    credentials: {
      effectiveGid: gid[1],
      effectiveUid: uid[1],
      realGid: gid[0],
      realUid: uid[0],
      savedGid: gid[2],
      savedUid: uid[2],
      supplementaryGroups: groups,
    },
  };
}
function normalizeMounts(rows, layout) {
  if (!Array.isArray(rows)) fail();
  // Docker's configured bind projection is immutable.  A namespace unmount
  // changes only live /proc mountinfo, not this configuration snapshot.
  const expected = expectedMounts(layout);
  const normalized = expected.map((mount) => {
    const row = rows.find(
      (candidate) =>
        candidate?.Source === mount.source &&
        candidate.Destination === mount.target
    );
    if (
      row?.Type !== 'bind' ||
      row.RW !== !mount.readOnly ||
      !['rprivate', ''].includes(row.Propagation ?? '')
    )
      fail();
    return mount;
  });
  if (rows.filter((row) => row?.Type === 'bind').length !== expected.length)
    fail();
  return normalized;
}

async function verifyArtifacts(phase, layout, stat) {
  const artifacts = expectedArtifacts(phase, layout);
  for (const artifact of artifacts) {
    const details = await stat(artifact.path);
    if (
      details.isSymbolicLink() ||
      details.uid !== artifact.uid ||
      details.gid !== artifact.gid ||
      (details.mode & 0o777) !== artifact.mode ||
      (artifact.type === 'file' ? !details.isFile() : !details.isDirectory())
    )
      fail();
  }
  return artifacts;
}

// biome-ignore format: compact collector signature preserves the file-size gate
export function createRegistrationSnapshotCollector(configuration, dependencies) {
  const run = dependencies.executeFile ?? execFile;
  const read = dependencies.readFile ?? readFile;
  const link = dependencies.readlink ?? readlink;
  const stat = dependencies.lstat ?? lstat;
  const network = dependencies.network;
  const layout = registrationLayout(configuration.context);
  if (typeof run !== 'function' || typeof network?.inspectEgress !== 'function')
    fail();
  const execute = async (file, argv) => {
    const result = await run(file, argv, OPTIONS);
    if (
      !result ||
      typeof result.stdout !== 'string' ||
      typeof result.stderr !== 'string' ||
      result.stderr !== ''
    )
      fail();
    return result.stdout;
  };
  return async (phase) => {
    const artifacts = await verifyArtifacts(phase, layout, stat);
    const service = await execute(SYSTEMCTL, [
      'show',
      'baci-cwv-measurement.service',
      '--property=ActiveState',
      '--property=UnitFileState',
      '--value',
      '--no-pager',
    ]);
    const serviceRows = service.trimEnd().split('\n');
    if (serviceRows.length !== 2) fail();
    const normalService = {
      active: serviceRows[0] === 'active',
      enabled: serviceRows[1] === 'enabled',
    };
    const name = `baci-cwv-registration-${configuration.context.registrationNonce}`;
    let raw;
    try {
      raw = await execute(DOCKER, [
        `--host=${configuration.resources.dockerSocket}`,
        'inspect',
        '--format',
        '{{json [ .Id, .State.Running, .State.Pid, .Mounts ]}}',
        name,
      ]);
    } catch {
      raw = '';
    }
    let projection = null;
    if (raw) {
      try {
        projection = JSON.parse(raw);
      } catch {
        fail();
      }
    }
    const running = Array.isArray(projection) && projection[1] === true;
    if (!running) {
      if (!['pre-start', 'post-container'].includes(phase)) fail();
      return {
        artifacts,
        containers: [],
        egress: await network.inspectEgress(),
        environmentSha256: null,
        identity: null,
        normalService,
        schemaVersion: 1,
      };
    }
    const [containerId, , pid, mounts] = projection;
    if (
      !/^[a-f0-9]{64}$/.test(containerId) ||
      !Number.isSafeInteger(pid) ||
      pid < 2
    )
      fail();
    const root = `/proc/${pid}`;
    const [
      statusBytes,
      cgroupBytes,
      cmdline,
      executable,
      mountinfo,
      cgroupNamespace,
      mountNamespace,
      userNamespace,
    ] = await Promise.all([
      read(`${root}/status`),
      read(`${root}/cgroup`),
      read(`${root}/cmdline`),
      link(`${root}/exe`),
      read(`${root}/mountinfo`),
      link(`${root}/ns/cgroup`),
      link(`${root}/ns/mnt`),
      link(`${root}/ns/user`),
    ]);
    const status = parseStatus(statusBytes.toString('utf8'));
    const live = await collectRegistrationLiveProcessEvidence(pid, {
      link,
      read,
    });
    verifyRegistrationTokenMount(
      mountinfo,
      !['node-token-absent', 'listener-configure'].includes(phase)
    );
    const cgroupPath = cgroupBytes.toString('utf8').trim().replace(/^0::/, '');
    const expectedCgroup = `/cwv-measurement.slice/docker-${containerId}.scope`;
    if (
      cgroupPath !== expectedCgroup ||
      !isDeepStrictEqual(status.credentials, {
        effectiveGid: 10001,
        effectiveUid: 10001,
        realGid: 10001,
        realUid: 10001,
        savedGid: 10001,
        savedUid: 10001,
        supplementaryGroups: [10001],
      })
    )
      fail();
    const active = phase === 'listener-configure';
    const argv = cmdline.toString('utf8').split('\0').filter(Boolean);
    const executableSha256 = sha256(await read(executable));
    if (
      sha256(JSON.stringify(argv)) !==
        (active
          ? configuration.context.configureArgvSha256
          : configuration.context.nodeArgvSha256) ||
      executableSha256 !==
        (active
          ? configuration.context.listenerExecutableSha256
          : configuration.context.nodeExecutableSha256)
    )
      fail();
    const identity = {
      cgroupAncestry: [
        '/sys/fs/cgroup',
        '/sys/fs/cgroup/cwv-measurement.slice',
        `/sys/fs/cgroup${cgroupPath}`,
      ],
      cgroupPath: `/sys/fs/cgroup${cgroupPath}`,
      credentials: status.credentials,
      namespaces: {
        cgroup: cgroupNamespace,
        mnt: mountNamespace,
        user: userNamespace,
      },
    };
    return {
      artifacts,
      containers: [
        {
          cgroupNamespace,
          containerId,
          mountNamespace,
          mounts: normalizeMounts(mounts, layout),
          processes: [
            {
              argvSha256: active
                ? configuration.context.configureArgvSha256
                : configuration.context.nodeArgvSha256,
              containerPid: status.containerPid,
              executableSha256,
              parentIdentitySha256: live.parentIdentitySha256,
              pid,
            },
          ],
          userNamespace,
        },
      ],
      egress: await network.inspectEgress(),
      environmentSha256: live.environmentSha256,
      identity,
      normalService,
      schemaVersion: 1,
    };
  };
}
