import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { assertNormalModeClean } from './registration-controller.mjs';

const environment = {
  ACTIONS_RUNNER_HOOK_JOB_STARTED: '/run/baci-cwv-hooks/job-start-hook.sh',
  BACI_CWV_CAMPAIGN_ID: 'campaign-1',
  BACI_CWV_CAPTURE_SHA256: 'a'.repeat(64),
  BACI_CWV_LISTENER_RELEASE_DEADLINE_MONOTONIC_SECONDS: '3600',
  BACI_CWV_LISTENER_RELEASE_NOT_BEFORE_MONOTONIC_SECONDS: '1800',
  DISABLE_RUNNER_UPDATE: '1',
  LANG: 'C.UTF-8',
  LC_ALL: 'C.UTF-8',
  PATH: '/opt/node/bin:/opt/pnpm/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
  TZ: 'Etc/UTC',
};
const digest = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
const mutateEnvironment = (mutate) => (snapshot) => {
  mutate(snapshot.environment);
  snapshot.environmentSha256 = digest(snapshot.environment);
};
const clean = () => ({
  artifacts: [],
  environment: { ...environment },
  environmentSha256: digest(environment),
  mounts: [
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
  ],
});

test('normal mode admits only the Task 1 image and entrypoint runtime environment', () => {
  assert.doesNotThrow(() => assertNormalModeClean(clean()));
  for (const mutate of [
    mutateEnvironment((value) => {
      value.DEBUG = '1';
    }),
    (snapshot) => {
      snapshot.environmentSha256 = 'f'.repeat(64);
    },
    mutateEnvironment((value) => {
      value.API_TOKEN = 'ordinary';
    }),
    mutateEnvironment((value) => {
      value.LANG = 'Bearer ordinary-value';
    }),
    mutateEnvironment((value) => {
      value.BACI_CWV_CAMPAIGN_ID = 'Campaign_1';
    }),
    mutateEnvironment((value) => {
      value.BACI_CWV_CAPTURE_SHA256 = 'short';
    }),
    mutateEnvironment((value) => {
      value.BACI_CWV_LISTENER_RELEASE_DEADLINE_MONOTONIC_SECONDS = 'tomorrow';
    }),
    mutateEnvironment((value) => {
      value.BACI_CWV_LISTENER_RELEASE_DEADLINE_MONOTONIC_SECONDS = '1799';
    }),
    (snapshot) => {
      snapshot.artifacts.push('/srv/baci-cwv/registration-staging/stale');
    },
    (snapshot) => {
      snapshot.mounts.push('/run/baci-cwv/docker.sock');
    },
    (snapshot) => {
      snapshot.mounts.push('/run/secrets/runner-registration-token');
    },
    (snapshot) => {
      snapshot.mounts.push('/run/baci-cwv-registration-release');
    },
    (snapshot) => {
      snapshot.mounts.pop();
    },
  ]) {
    const snapshot = clean();
    mutate(snapshot);
    assert.throws(() => assertNormalModeClean(snapshot), /normal mode refused/);
  }
});

test('normal mode rejects the previously admitted wall-clock and incomplete environment', () => {
  const snapshot = clean();
  delete snapshot.environment
    .BACI_CWV_LISTENER_RELEASE_DEADLINE_MONOTONIC_SECONDS;
  delete snapshot.environment
    .BACI_CWV_LISTENER_RELEASE_NOT_BEFORE_MONOTONIC_SECONDS;
  delete snapshot.environment.LC_ALL;
  delete snapshot.environment.TZ;
  snapshot.environment.BACI_CWV_LISTENER_DEADLINE = '2026-07-21T21:00:00Z';
  snapshot.environment.BACI_CWV_LISTENER_NOT_BEFORE = '2026-07-21T20:30:00Z';
  snapshot.environment.HOME = '/home/runner';
  snapshot.environmentSha256 = digest(snapshot.environment);
  assert.throws(() => assertNormalModeClean(snapshot), /normal mode refused/);
});
