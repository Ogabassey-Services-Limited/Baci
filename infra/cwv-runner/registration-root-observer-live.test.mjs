import assert from 'node:assert/strict';
import test from 'node:test';

import { canonicalSha256 } from './canonical-json.mjs';
import { collectRegistrationLiveProcessEvidence } from './registration-root-observer-live.mjs';

const processFiles = (environment) =>
  new Map([
    ['/proc/4312/environ', Buffer.from(environment)],
    ['/proc/4312/status', Buffer.from('Name:\tnode\nPPid:\t4313\n')],
    ['/proc/4313/status', Buffer.from('Name:\tshim\nPPid:\t4314\n')],
    [
      '/proc/4313/cgroup',
      Buffer.from('0::/system.slice/baci-cwv-containerd.service\n'),
    ],
    ['/proc/4314/status', Buffer.from('Name:\tcontainerd\nPPid:\t1\n')],
    [
      '/proc/4314/cgroup',
      Buffer.from('0::/system.slice/baci-cwv-containerd.service\n'),
    ],
  ]);

test('hashes normalized live process environment and dedicated daemon parent chain', async () => {
  const files = processFiles('LANG=C.UTF-8\0PATH=/opt/node/bin\0');
  const evidence = await collectRegistrationLiveProcessEvidence(4312, {
    link: (path) =>
      path === '/proc/4313/exe'
        ? '/usr/bin/containerd-shim-runc-v2'
        : '/usr/bin/containerd',
    read: (path) => files.get(path),
  });
  assert.equal(
    evidence.environmentSha256,
    canonicalSha256({ LANG: 'C.UTF-8', PATH: '/opt/node/bin' })
  );
  assert.match(evidence.parentIdentitySha256, /^[a-f0-9]{64}$/);
  const changed = await collectRegistrationLiveProcessEvidence(4312, {
    link: (path) =>
      path === '/proc/4313/exe'
        ? '/usr/bin/containerd-shim-runc-v2'
        : '/usr/bin/containerd',
    read: (path) => processFiles('LANG=C.UTF-8\0PATH=/changed\0').get(path),
  });
  assert.notEqual(changed.environmentSha256, evidence.environmentSha256);
});
