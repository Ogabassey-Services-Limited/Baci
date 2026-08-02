import assert from 'node:assert/strict';
import test from 'node:test';

import {
  controllerContext,
  observedAuthority,
  resourceContract,
} from './controller-contract.fixture.mjs';
import { createRegistrationExclusiveGuard } from './registration-root-guard.mjs';

const status = (uid = 10001, gid = 10001, groups = '10001') =>
  `Uid:\t${uid}\t${uid}\t${uid}\t${uid}\nGid:\t${gid}\t${gid}\t${gid}\t${gid}\nGroups:\t${groups}\n`;
const procError = (code) => Object.assign(new Error(code), { code });
const createGuard = (dependencies) =>
  createRegistrationExclusiveGuard(
    { context: controllerContext, resources: resourceContract },
    dependencies
  );

function fixture(pids, containers = valueContainers(pids)) {
  const calls = [];
  const namespaces = {
    cgroup: observedAuthority.cgroupNamespace,
    mnt: observedAuthority.mountNamespace,
    user: observedAuthority.userNamespace,
  };
  return {
    calls,
    namespaces,
    dependencies: {
      defaultDrop: async () => calls.push('drop'),
      inspectDedicated: async () => ({
        containers:
          typeof containers === 'function' ? containers() : containers,
      }),
      kill: async () => calls.push('kill'),
      listProc: async () => Object.keys(pids),
      readFile: (path) => {
        const [, pid, name] =
          /^\/proc\/(\d+)\/(status|cgroup|mountinfo)$/.exec(path) ?? [];
        const value = pids[pid];
        return Buffer.from(
          name === 'status'
            ? value?.status
            : name === 'cgroup'
              ? value?.cgroup
              : (value?.mountinfo ?? '')
        );
      },
      readlink: async (path) =>
        path.endsWith('/ns/cgroup')
          ? namespaces.cgroup
          : path.endsWith('/ns/mnt')
            ? namespaces.mnt
            : namespaces.user,
    },
  };
}

function valueContainers(pids) {
  return Object.keys(pids).map((pid) => ({
    id:
      pid === String(observedAuthority.listenerPid)
        ? observedAuthority.containerId
        : 'b'.repeat(64),
    name: `baci-cwv-registration-${'c'.repeat(32)}`,
    state: 'running',
  }));
}

test('arms before token parent only when UID/GID 10001 is absent', async () => {
  const { dependencies } = fixture(
    { 77: { cgroup: '0::/system.slice', status: status(0, 0, '0') } },
    []
  );
  const guard = createGuard(dependencies);
  const receipt = await guard('before-token-parent');
  assert.match(receipt.guardReceiptSha256, /^[a-f0-9]{64}$/);
});

test('accepts an unrelated host process with no supplementary groups', async () => {
  const { dependencies } = fixture(
    { 77: { cgroup: '0::/system.slice', status: status(0, 0, '') } },
    []
  );
  const guard = createGuard(dependencies);
  assert.equal((await guard('before-token-parent')).guardSequence, 1);
});

test('skips only ENOENT and ESRCH when a listed host PID exits', async () => {
  for (const [method, code, suffix] of [
    ['readFile', 'ENOENT', '/status'],
    ['readlink', 'ESRCH', '/ns/user'],
  ]) {
    const current = fixture(
      {
        77: { cgroup: '0::/system.slice', status: status(0, 0, '') },
        78: { cgroup: '0::/system.slice', status: status(0, 0, '') },
      },
      []
    );
    const original = current.dependencies[method];
    current.dependencies[method] = (path) =>
      path === `/proc/78${suffix}`
        ? Promise.reject(procError(code))
        : original(path);
    const guard = createGuard(current.dependencies);
    assert.equal((await guard('before-token-parent')).guardSequence, 1);
  }
});

test('refuses malformed UID/GID with no supplementary groups', async () => {
  const current = fixture(
    { 77: { cgroup: '0::/system.slice', status: status('invalid', 0, '') } },
    []
  );
  const guard = createGuard(current.dependencies);
  await assert.rejects(
    guard('before-token-parent'),
    /registration guard refused/
  );
  assert.deepEqual(current.calls, ['drop', 'kill']);
});

test('contains non-race read and readlink proc errors', async () => {
  for (const [method, code, suffix] of [
    ['readFile', 'EACCES', '/status'],
    ['readlink', 'EIO', '/ns/user'],
  ]) {
    const current = fixture(
      { 77: { cgroup: '0::/system.slice', status: status(0, 0, '') } },
      []
    );
    const original = current.dependencies[method];
    current.dependencies[method] = (path) =>
      path === `/proc/77${suffix}`
        ? Promise.reject(procError(code))
        : original(path);
    const guard = createGuard(current.dependencies);
    await assert.rejects(
      guard('before-token-parent'),
      /registration guard refused/
    );
    assert.deepEqual(current.calls, ['drop', 'kill']);
  }
});

test('rejects a second UID/GID 10001 process and drops before terminating', async () => {
  const expected = observedAuthority.runtimeIdentity.cgroupPath.replace(
    '/sys/fs/cgroup',
    ''
  );
  const pids = {
    77: { cgroup: '0::/system.slice', status: status(0, 0, '0') },
  };
  const { calls, dependencies } = fixture(pids, () =>
    '4312' in pids ? valueContainers(pids) : []
  );
  const guard = createGuard(dependencies);
  await guard('before-token-parent');
  delete pids[77];
  Object.assign(pids, {
    4312: {
      cgroup: `0::${expected}\n`,
      mountinfo:
        '1 2 0:1 / /run/secrets/runner-registration-token ro - tmpfs tmpfs ro',
      status: status(),
    },
    4313: { cgroup: '0::/sibling.scope\n', status: status() },
  });
  await assert.rejects(
    guard('registration-ready', observedAuthority),
    /registration guard refused/
  );
  assert.deepEqual(calls, ['drop', 'kill']);
});

test('rejects a missing token mount at the registration-ready boundary', async () => {
  const expected = observedAuthority.runtimeIdentity.cgroupPath.replace(
    '/sys/fs/cgroup',
    ''
  );
  const pids = {
    77: { cgroup: '0::/system.slice', status: status(0, 0, '0') },
  };
  const { dependencies } = fixture(pids, () =>
    '4312' in pids ? valueContainers(pids) : []
  );
  const guard = createGuard(dependencies);
  await guard('before-token-parent');
  delete pids[77];
  Object.assign(pids, {
    4312: { cgroup: `0::${expected}\n`, mountinfo: '', status: status() },
  });
  await assert.rejects(
    guard('registration-ready', observedAuthority),
    /registration guard refused/
  );
});

test('rejects mount namespace drift after the guard has armed', async () => {
  const expected = observedAuthority.runtimeIdentity.cgroupPath.replace(
    '/sys/fs/cgroup',
    ''
  );
  const pids = {
    77: { cgroup: '0::/system.slice', status: status(0, 0, '0') },
  };
  const { dependencies, namespaces } = fixture(pids, () =>
    '4312' in pids ? valueContainers(pids) : []
  );
  const guard = createGuard(dependencies);
  await guard('before-token-parent');
  delete pids[77];
  Object.assign(pids, {
    4312: {
      cgroup: `0::${expected}\n`,
      mountinfo:
        '1 2 0:1 / /run/secrets/runner-registration-token ro - tmpfs tmpfs ro',
      status: status(),
    },
  });
  namespaces.mnt = 'mnt:[999]';
  await assert.rejects(
    guard('registration-ready', observedAuthority),
    /registration guard refused/
  );
});

test('terminates asynchronously when a runner identity appears between boundaries', async () => {
  const pids = {
    77: { cgroup: '0::/system.slice', status: status(0, 0, '0') },
  };
  const { calls, dependencies } = fixture(pids, () => []);
  let tick;
  const guard = createGuard({
    ...dependencies,
    clearInterval: () => undefined,
    setInterval: (callback) => {
      tick = callback;
      return 1;
    },
  });
  await guard('before-token-parent');
  pids[4313] = {
    cgroup: '0::/sibling.scope\n',
    mountinfo: '',
    status: status(),
  };
  tick();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, ['drop', 'kill']);
  await assert.rejects(guard('token-created'), /registration guard refused/);
});

test('proves the established registration identity is absent at before-seal', async () => {
  const { dependencies } = fixture(
    { 77: { cgroup: '0::/system.slice', status: status(0, 0, '0') } },
    []
  );
  const guard = createGuard(dependencies);
  await guard('before-token-parent');
  assert.match(
    (await guard('before-seal', observedAuthority)).guardReceiptSha256,
    /^[a-f0-9]{64}$/
  );
});

test('refuses an exited registration container before sealing', async () => {
  let containers = [];
  const { calls, dependencies } = fixture(
    { 77: { cgroup: '0::/system.slice', status: status(0, 0, '0') } },
    () => containers
  );
  const guard = createGuard(dependencies);
  await guard('before-token-parent');
  containers = [
    {
      ...valueContainers({ [observedAuthority.listenerPid]: {} })[0],
      state: 'exited',
    },
  ];
  await assert.rejects(
    guard('before-seal', observedAuthority),
    /registration guard refused/
  );
  assert.deepEqual(calls, ['drop', 'kill']);
});
