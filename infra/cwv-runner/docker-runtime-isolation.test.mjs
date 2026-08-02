import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (name) => readFile(new URL(name, import.meta.url), 'utf8');
const dockerRuntime = Object.freeze({
  execRoot: '/run/baci-cwv/docker-exec',
  pidFile: '/run/baci-cwv/docker.pid',
  socket: '/run/baci-cwv/docker.sock',
});

function serviceValues(source, key) {
  return [...source.matchAll(new RegExp(`^${key}=(.+)$`, 'gm'))].map(
    (match) => match[1]
  );
}

test('dedicated Docker freezes flat runtime paths without removing their shared parent', async () => {
  const [daemonSource, dockerUnit, containerdUnit, samplerUnit, policySource] =
    await Promise.all([
      read('./daemon.json'),
      read('./baci-cwv-docker.service'),
      read('./baci-cwv-containerd.service'),
      read('./baci-cwv-host-sampler.service'),
      read('./policy.json'),
    ]);
  const daemon = JSON.parse(daemonSource);
  const policy = JSON.parse(policySource).dedicatedRuntime;

  assert.deepEqual(
    {
      execRoot: daemon['exec-root'],
      pidFile: daemon.pidfile,
      socket: daemon.hosts?.[0]?.replace('unix://', ''),
    },
    dockerRuntime
  );
  assert.deepEqual(
    {
      execRoot: policy.dockerExecRoot,
      pidFile: policy.dockerPidFile,
      socket: policy.dockerSocket,
    },
    dockerRuntime
  );
  assert.deepEqual(serviceValues(dockerUnit, 'RuntimeDirectory'), ['baci-cwv']);
  assert.deepEqual(serviceValues(dockerUnit, 'RuntimeDirectoryPreserve'), [
    'yes',
  ]);
  assert.deepEqual(serviceValues(containerdUnit, 'RuntimeDirectory'), [
    'baci-cwv baci-cwv/containerd',
  ]);
  assert.deepEqual(serviceValues(containerdUnit, 'RuntimeDirectoryPreserve'), [
    'yes',
  ]);
  const writable = serviceValues(dockerUnit, 'ReadWritePaths')[0].split(' ');
  assert.ok(writable.includes('/run/baci-cwv'));
  assert.equal(writable.includes('/run/baci-cwv/docker'), false);
  assert.match(
    samplerUnit,
    /^EnvironmentFile=\/run\/baci-cwv\/host-sampler\.env$/m
  );
});
