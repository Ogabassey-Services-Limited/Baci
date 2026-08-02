import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  matchesContainerStorageProjection,
  normalRunnerBinds,
  normalRunnerDynamicEnvironment,
  normalRunnerMounts,
  normalRunnerServiceTmpfs,
  normalRunnerStaticEnvironment,
  normalRunnerTmpfs,
} from './measurement-container-projection.mjs';
import { assertNormalRuntimeState } from './registration-controller-normal-mode.mjs';

const normalProjection = () => ({
  binds: [...normalRunnerBinds],
  mounts: normalRunnerMounts.map((mount) => ({ ...mount })),
  tmpfs: { ...normalRunnerTmpfs },
});

function assertWrapperStorageContract(wrapper) {
  const startOffset = wrapper.indexOf('start() {');
  const stopOffset = wrapper.indexOf('\ndocker_stop()', startOffset);
  assert.ok(startOffset >= 0, 'measurement wrapper start');
  assert.ok(stopOffset > startOffset, 'measurement wrapper stop');
  const start = wrapper.slice(startOffset, stopOffset);
  for (const bind of normalRunnerBinds)
    assert.ok(start.includes(`--volume=${bind}`), bind);
  for (const [target, options] of Object.entries(normalRunnerServiceTmpfs))
    assert.ok(start.includes(`--tmpfs=${target}:${options}`), target);
  assert.deepEqual(
    [...start.matchAll(/(?:^|\s)--volume=([^\s\\]+)/g)]
      .map((match) => match[1])
      .sort(),
    [...normalRunnerBinds].sort(),
    'measurement wrapper volume set must be exact'
  );
  assert.deepEqual(
    [...start.matchAll(/(?:^|\s)--tmpfs=([^\s\\]+)/g)]
      .map((match) => match[1])
      .sort(),
    Object.entries(normalRunnerServiceTmpfs)
      .map(([target, options]) => `${target}:${options}`)
      .sort(),
    'measurement wrapper tmpfs set must be exact'
  );
}

test('matches the real normal measurement service projection exactly', async () => {
  const service = await readFile(
    new URL('./baci-cwv-measurement.service', import.meta.url),
    'utf8'
  );
  const wrapper = await readFile(
    new URL('./measurement-service-wrapper.sh', import.meta.url),
    'utf8'
  );
  const projection = normalProjection();
  assert.equal(matchesContainerStorageProjection(projection, false), true);
  assertWrapperStorageContract(wrapper);
  assert.match(
    service,
    /^ExecStart=.*measurement-service-wrapper\.sh start \/run\/baci-cwv-measurement\/input\.env$/m
  );
  assert.doesNotMatch(service, /^EnvironmentFile=/m);
  assert.doesNotMatch(service, /\/srv\/baci-cwv\/sealed\/image-id/);
  for (const name of normalRunnerDynamicEnvironment.slice(0, 2))
    assert.ok(wrapper.includes(`--env=${name}`), name);
  assert.ok(
    wrapper.includes(
      '--env=BACI_CWV_LISTENER_RELEASE_DEADLINE_MONOTONIC_SECONDS'
    )
  );
  assert.ok(
    wrapper.includes(
      '--env=BACI_CWV_LISTENER_RELEASE_NOT_BEFORE_MONOTONIC_SECONDS'
    )
  );
  assert.doesNotMatch(wrapper, /--env=HOME(?:=|\s|$)/);
});

test('binds the admission parent so atomic active.json publication remains visible', () => {
  assert.ok(
    normalRunnerBinds.includes('/srv/baci-cwv/allow:/run/baci-cwv-admission:ro')
  );
  assert.equal(
    normalRunnerBinds.includes(
      '/srv/baci-cwv/allow/active.json:/run/baci-cwv-admission/admission.json:ro'
    ),
    false
  );
});

test('refuses an extra measurement service volume', async () => {
  const service = await readFile(
    new URL('./measurement-service-wrapper.sh', import.meta.url),
    'utf8'
  );
  const mutated = service.replace(
    '  --volume=/srv/baci-cwv/evidence:/host-evidence:ro \\',
    '  --volume=/srv/baci-cwv/evidence:/host-evidence:ro \\\n  --volume=/etc/shadow:/unreviewed:ro \\'
  );
  assert.throws(() => assertWrapperStorageContract(mutated), /volume/);
});

test('refuses an extra measurement service tmpfs', async () => {
  const service = await readFile(
    new URL('./measurement-service-wrapper.sh', import.meta.url),
    'utf8'
  );
  const mutated = service.replace(
    '  --tmpfs=/tmp:rw,noexec,nosuid,nodev,size=268435456,mode=1777 \\',
    '  --tmpfs=/tmp:rw,noexec,nosuid,nodev,size=268435456,mode=1777 \\\n  --tmpfs=/unreviewed:rw,size=4096 \\'
  );
  assert.throws(() => assertWrapperStorageContract(mutated), /tmpfs/);
});

test('matches the normal controller full environment without synthetic HOME', () => {
  const environment = {
    ...normalRunnerStaticEnvironment,
    BACI_CWV_CAMPAIGN_ID: 'campaign-1',
    BACI_CWV_CAPTURE_SHA256: 'a'.repeat(64),
    BACI_CWV_LISTENER_RELEASE_DEADLINE_MONOTONIC_SECONDS: '3600',
    BACI_CWV_LISTENER_RELEASE_NOT_BEFORE_MONOTONIC_SECONDS: '1800',
  };
  assert.deepEqual(
    Object.keys(environment)
      .filter((key) => key.startsWith('BACI_CWV_'))
      .sort(),
    [...normalRunnerDynamicEnvironment].sort()
  );
  assert.equal(Object.hasOwn(environment, 'HOME'), false);
  assert.doesNotThrow(() =>
    assertNormalRuntimeState({
      artifacts: [],
      environment,
      environmentSha256: createHash('sha256')
        .update(JSON.stringify(environment))
        .digest('hex'),
      mounts: [
        '/home/runner',
        '/tmp',
        ...normalRunnerBinds.map((bind) => bind.split(':')[1]),
      ],
    })
  );
});

test('refuses wrong or extra binds, mount modes, and tmpfs sizes', () => {
  for (const mutate of [
    (value) => (value.binds[0] = `${value.binds[0]}:z`),
    (value) => value.binds.push('/srv/baci-cwv/writable/extra:/extra:rw'),
    (value) => (value.mounts[1].Mode = 'ro'),
    (value) =>
      (value.tmpfs['/tmp'] = 'rw,noexec,nosuid,nodev,size=16777216,mode=1777'),
  ]) {
    const projection = normalProjection();
    mutate(projection);
    assert.equal(matchesContainerStorageProjection(projection, false), false);
  }
});

test('matches Docker mounts by stable destination rather than inspect order', () => {
  const projection = normalProjection();
  projection.mounts.reverse();

  assert.equal(matchesContainerStorageProjection(projection, false), true);
});

test('keeps rehearsal closed and distinct from the normal service', () => {
  const rehearsal = {
    binds: null,
    mounts: [],
    tmpfs: {
      '/home/runner': 'rw,noexec,nosuid,nodev,size=16777216,mode=700',
      '/tmp': 'rw,noexec,nosuid,nodev,size=16777216,mode=1777',
    },
  };
  assert.equal(matchesContainerStorageProjection(rehearsal, true), true);
  assert.equal(
    matchesContainerStorageProjection(normalProjection(), true),
    false
  );
});
