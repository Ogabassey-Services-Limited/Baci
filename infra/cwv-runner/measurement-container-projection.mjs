const canonical = (value) =>
  Array.isArray(value)
    ? `[${value.map(canonical).join(',')}]`
    : value && typeof value === 'object'
      ? `{${Object.keys(value)
          .sort()
          .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
          .join(',')}}`
      : JSON.stringify(value);

const same = (actual, expected) =>
  Array.isArray(actual) &&
  actual.length === expected.length &&
  actual.every((item, index) => item === expected[index]);
const empty = (value) =>
  value === null || (Array.isArray(value) && value.length === 0);

export const normalRunnerBinds = Object.freeze([
  '/srv/baci-cwv/sealed/actions-runner:/opt/runner:ro',
  '/srv/baci-cwv/writable/_diag:/opt/runner/_diag:rw',
  '/srv/baci-cwv/writable/_work:/runner-work:rw',
  '/srv/baci-cwv/writable/scratch:/runner-scratch:rw',
  '/srv/baci-cwv/sealed/policy.sha256:/run/baci-cwv-policy/policy.sha256:ro',
  '/srv/baci-cwv/hooks/job-start-hook.sh:/run/baci-cwv-hooks/job-start-hook.sh:ro',
  '/srv/baci-cwv/allow:/run/baci-cwv-admission:ro',
  '/srv/baci-cwv/listener-release:/run/baci-cwv-listener-release:ro',
  '/srv/baci-cwv/evidence:/host-evidence:ro',
]);

export const normalRunnerServiceTmpfs = Object.freeze({
  '/home/runner':
    'rw,noexec,nosuid,nodev,size=67108864,mode=0700,uid=10001,gid=10001',
  '/tmp': 'rw,noexec,nosuid,nodev,size=268435456,mode=1777',
});

export const normalRunnerTmpfs = Object.freeze({
  '/home/runner':
    'rw,noexec,nosuid,nodev,size=67108864,mode=700,uid=10001,gid=10001',
  '/tmp': 'rw,noexec,nosuid,nodev,size=268435456,mode=1777',
});

export const normalRunnerDynamicEnvironment = Object.freeze([
  'BACI_CWV_CAMPAIGN_ID',
  'BACI_CWV_CAPTURE_SHA256',
  'BACI_CWV_LISTENER_RELEASE_NOT_BEFORE_MONOTONIC_SECONDS',
  'BACI_CWV_LISTENER_RELEASE_DEADLINE_MONOTONIC_SECONDS',
]);

export const normalRunnerStaticEnvironment = Object.freeze({
  ACTIONS_RUNNER_HOOK_JOB_STARTED: '/run/baci-cwv-hooks/job-start-hook.sh',
  DISABLE_RUNNER_UPDATE: '1',
  LANG: 'C.UTF-8',
  LC_ALL: 'C.UTF-8',
  PATH: '/opt/node/bin:/opt/pnpm/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
  TZ: 'Etc/UTC',
});

export const normalRunnerMounts = Object.freeze(
  normalRunnerBinds.map((bind) => {
    const [Source, Destination, Mode] = bind.split(':');
    return Object.freeze({
      Destination,
      Mode,
      Propagation: 'rprivate',
      RW: Mode === 'rw',
      Source,
      Type: 'bind',
    });
  })
);

const rehearsalTmpfs = Object.freeze({
  '/home/runner': 'rw,noexec,nosuid,nodev,size=16777216,mode=700',
  '/tmp': 'rw,noexec,nosuid,nodev,size=16777216,mode=1777',
});
const mountKeys = [
  'Destination',
  'Mode',
  'Propagation',
  'RW',
  'Source',
  'Type',
];

function sameMounts(actual) {
  const byDestination = new Map(
    Array.isArray(actual)
      ? actual.map((mount) => [mount?.Destination, mount])
      : []
  );
  return (
    Array.isArray(actual) &&
    actual.length === normalRunnerMounts.length &&
    byDestination.size === actual.length &&
    normalRunnerMounts.every((expected) => {
      const mount = byDestination.get(expected.Destination);
      return (
        mount &&
        typeof mount === 'object' &&
        !Array.isArray(mount) &&
        canonical(Object.keys(mount).sort()) === canonical(mountKeys) &&
        canonical(mount) === canonical(expected)
      );
    })
  );
}

export function matchesContainerStorageProjection(runner, rehearsal) {
  return rehearsal
    ? empty(runner.binds) &&
        empty(runner.mounts) &&
        canonical(runner.tmpfs) === canonical(rehearsalTmpfs)
    : same(runner.binds, normalRunnerBinds) &&
        sameMounts(runner.mounts) &&
        canonical(runner.tmpfs) === canonical(normalRunnerTmpfs);
}
