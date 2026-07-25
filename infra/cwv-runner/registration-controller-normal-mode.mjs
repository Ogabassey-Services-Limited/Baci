import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

const staticEnvironment = Object.freeze({
  ACTIONS_RUNNER_HOOK_JOB_STARTED: '/run/baci-cwv-hooks/job-start-hook.sh',
  DISABLE_RUNNER_UPDATE: '1',
  LANG: 'C.UTF-8',
  LC_ALL: 'C.UTF-8',
  PATH: '/opt/node/bin:/opt/pnpm/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
  TZ: 'Etc/UTC',
});
const dynamicEnvironmentKeys = Object.freeze([
  'BACI_CWV_CAMPAIGN_ID',
  'BACI_CWV_CAPTURE_SHA256',
  'BACI_CWV_LISTENER_RELEASE_DEADLINE_MONOTONIC_SECONDS',
  'BACI_CWV_LISTENER_RELEASE_NOT_BEFORE_MONOTONIC_SECONDS',
]);
const normalMounts = Object.freeze([
  '/home/runner',
  '/host-evidence',
  '/opt/runner',
  '/opt/runner/_diag',
  '/run/baci-cwv-admission',
  '/run/baci-cwv-hooks/job-start-hook.sh',
  '/run/baci-cwv-listener-release',
  '/run/baci-cwv-policy/policy.sha256',
  '/runner-scratch',
  '/runner-work',
  '/tmp',
]);
const secretShape =
  /token|secret|password|credential|cookie|authorization|private.?key|api.?key|bearer[ \t]|ghp_|ghs_|github_pat_|cfat_/i;
const monotonicSeconds = (value) =>
  typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value);

const exactKeys = (value, keys) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort());
const digest = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function assertNormalRuntimeState(snapshot) {
  const environment = snapshot?.environment;
  const notBefore =
    environment?.BACI_CWV_LISTENER_RELEASE_NOT_BEFORE_MONOTONIC_SECONDS;
  const deadline =
    environment?.BACI_CWV_LISTENER_RELEASE_DEADLINE_MONOTONIC_SECONDS;
  if (
    !exactKeys(snapshot, [
      'artifacts',
      'environment',
      'environmentSha256',
      'mounts',
    ]) ||
    !exactKeys(environment, [
      ...Object.keys(staticEnvironment),
      ...dynamicEnvironmentKeys,
    ]) ||
    !Object.entries(staticEnvironment).every(
      ([key, value]) => environment[key] === value
    ) ||
    !/^[a-z0-9][a-z0-9-]{0,62}$/.test(environment.BACI_CWV_CAMPAIGN_ID) ||
    !/^[a-f0-9]{64}$/.test(environment.BACI_CWV_CAPTURE_SHA256) ||
    !monotonicSeconds(notBefore) ||
    !monotonicSeconds(deadline) ||
    Number(deadline) < Number(notBefore) ||
    snapshot.environmentSha256 !== digest(environment) ||
    Object.entries(environment).some(
      ([key, value]) => secretShape.test(key) || secretShape.test(value)
    ) ||
    !isDeepStrictEqual(snapshot.artifacts, []) ||
    !Array.isArray(snapshot.mounts) ||
    !isDeepStrictEqual([...snapshot.mounts].sort(), [...normalMounts].sort())
  )
    throw new TypeError('normal mode refused');
  return snapshot;
}
