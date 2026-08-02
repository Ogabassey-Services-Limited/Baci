// biome-ignore-all format: compact process fixtures stay within the source ceiling.
import assert from 'node:assert/strict';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { canonicalJson } from './canonical-json.mjs';
import { imageProcessMap, sealedPaths } from './image-process-map.mjs';
import { parseRunnerPolicy } from './policy.schema.mjs';
import { collectProcessInventory } from './process-inventory.mjs';

const policy = parseRunnerPolicy(
  JSON.parse(readFileSync(new URL('./policy.json', import.meta.url), 'utf8'))
);
const hex = (character) => character.repeat(64);

function fixture({ visibleCgroup } = {}) {
  const root = realpathSync(
    mkdtempSync(join(tmpdir(), 'baci-cwv-process-inventory-'))
  );
  for (const path of new Set([
    ...sealedPaths,
    ...Object.values(policy.processAllowSet.executables).map(({ path }) => path),
  ])) {
    const target = join(root, path);
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, path);
    chmodSync(target, 0o555);
  }
  const map = imageProcessMap(policy, root);
  for (const entry of [...map.entries, ...map.sealed]) {
    entry.owner = '0:0';
    entry.realpath = entry.path;
  }
  const write = (path, value) => {
    const target = join(root, path);
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, value);
  };
  write('/opt/baci-cwv/image-process-map.json', `${canonicalJson(map)}\n`);
  write('/opt/baci-cwv/policy.json', `${canonicalJson(policy)}\n`);
  write('/etc/hostname', `${'a'.repeat(12)}\n`);
  write(
    '/run/baci-cwv-admission/active.json',
    `${canonicalJson({
      admissionId: hex('b'),
      campaignId: 'campaign-01',
      expectedSha: 'c'.repeat(40),
      expiresMonotonicSeconds: 11,
      kind: 'allow',
      policyFileSha256: hex('d'),
      repository: { id: 1100488586, name: 'ogabasseyy/Baci' },
      run: { attempt: 1, id: 42 },
      runner: { generation: 1, id: 7, name: 'baci-cwv-measurement-01' },
      schemaVersion: 1,
      workflow: { id: 9, job: 'attest', path: '.github/workflows/cwv-runner-attestation.yml', ref: 'refs/heads/main' },
    })}\n`
  );
  write(
    '/run/baci-cwv-listener-release/release.json',
    `${canonicalJson({
      campaignId: 'campaign-01',
      captureSha256: hex('e'),
      classifierSha256: hex('f'),
      containerId: hex('a'),
      containerPrefix: 'a'.repeat(12),
      createdMonotonicSeconds: 9,
      egressIdentity: 'external:eth0:2',
      expiresMonotonicSeconds: 11,
      liveSampleSha256: hex('1'),
      peerIdentity: 'veth:veth0:3',
      policyFileSha256: hex('d'),
      runnerIp: '192.0.2.2',
      vethIdentity: 'veth0',
    })}\n`
  );
  const cgroup = `/cwv-measurement.slice/docker-${hex('a')}.scope`;
  const observedCgroup = visibleCgroup ?? cgroup;
  write(`/cwv${observedCgroup === '/' ? '' : observedCgroup}/cpuset.cpus.effective`, '2-3\n');
  const process = (pid, parentPid, role) => {
    const entry = map.entries.find((candidate) => candidate.role === role);
    write(`/proc/${pid}/stat`, `${pid} (${role}) S ${parentPid} 0 0\n`);
    write(`/proc/${pid}/cgroup`, `0::${observedCgroup}\n`);
    symlinkSync(join(root, entry.path), join(root, `/proc/${pid}/exe`));
  };
  process(11, 0, 'runtimeNode');
  process(12, 11, 'listener');
  process(99, 0, 'runtimeNode');
  return { cgroup, root };
}

test('collects a canonical listener-idle inventory bound to the mounted allow and release', () => {
  const value = fixture();
  try {
    assert.deepEqual(
      collectProcessInventory({
        cgroupRoot: join(value.root, 'cwv'),
        collectorPid: 99,
        hostnamePath: join(value.root, 'etc/hostname'),
        nowMonotonicSeconds: () => 10,
        pathRoot: value.root,
        procRoot: join(value.root, 'proc'),
        readPaths: {
          allow: join(value.root, 'run/baci-cwv-admission/active.json'),
          map: join(value.root, 'opt/baci-cwv/image-process-map.json'),
          policy: join(value.root, 'opt/baci-cwv/policy.json'),
          release: join(value.root, 'run/baci-cwv-listener-release/release.json'),
        },
      }),
      {
        busy: false,
        phase: 'listener-idle',
        processes: [
          {
            cgroupPath: value.cgroup,
            containerId: hex('a'),
            cpuset: '2-3',
            exe: '/opt/node/bin/node',
            generation: 1,
            parentPid: 0,
            pid: 11,
            role: 'runtimeNode',
            sha256: imageProcessMap(policy, value.root).entries.find((entry) => entry.role === 'runtimeNode').sha256,
          },
          {
            cgroupPath: value.cgroup,
            containerId: hex('a'),
            cpuset: '2-3',
            exe: '/opt/runner/bin/Runner.Listener',
            generation: 1,
            parentPid: 11,
            pid: 12,
            role: 'listener',
            sha256: imageProcessMap(policy, value.root).entries.find((entry) => entry.role === 'listener').sha256,
          },
        ],
      }
    );
  } finally {
    rmSync(value.root, { force: true, recursive: true });
  }
});

test('binds a private cgroup namespace snapshot to the host release identity', () => {
  const value = fixture({ visibleCgroup: '/' });
  try {
    const result = collectProcessInventory({
      cgroupRoot: join(value.root, 'cwv'),
      collectorPid: 99,
      hostnamePath: join(value.root, 'etc/hostname'),
      pathRoot: value.root,
      procRoot: join(value.root, 'proc'),
      readPaths: {
        allow: join(value.root, 'run/baci-cwv-admission/active.json'),
        map: join(value.root, 'opt/baci-cwv/image-process-map.json'),
        release: join(value.root, 'run/baci-cwv-listener-release/release.json'),
      },
    });
    assert.equal(result.phase, 'listener-idle');
    assert.equal(result.processes[0].cgroupPath, value.cgroup);
    assert.equal(result.processes[0].cpuset, '2-3');
  } finally {
    rmSync(value.root, { force: true, recursive: true });
  }
});

test('fails closed for an unknown stable process', () => {
  const value = fixture();
  try {
    writeFileSync(join(value.root, 'unknown'), 'unknown');
    mkdirSync(join(value.root, 'proc/13'), { recursive: true });
    writeFileSync(join(value.root, 'proc/13/stat'), '13 (unknown) S 0 0 0\n');
    writeFileSync(join(value.root, 'proc/13/cgroup'), `0::${value.cgroup}\n`);
    symlinkSync(join(value.root, 'unknown'), join(value.root, 'proc/13/exe'));
    assert.throws(
      () => collectProcessInventory({ cgroupRoot: join(value.root, 'cwv'), collectorPid: 99, hostnamePath: join(value.root, 'etc/hostname'), pathRoot: value.root, procRoot: join(value.root, 'proc'), readPaths: { allow: join(value.root, 'run/baci-cwv-admission/active.json'), map: join(value.root, 'opt/baci-cwv/image-process-map.json'), release: join(value.root, 'run/baci-cwv-listener-release/release.json') } }),
      /process executable$/
    );
  } finally {
    rmSync(value.root, { force: true, recursive: true });
  }
});

test('fails closed when the proc PID snapshot changes during collection', () => {
  const value = fixture();
  try {
    let calls = 0;
    assert.throws(
      () =>
        collectProcessInventory({
          cgroupRoot: join(value.root, 'cwv'),
          collectorPid: 99,
          hostnamePath: join(value.root, 'etc/hostname'),
          listPids() {
            calls += 1;
            return calls === 1 ? [11, 12] : [11, 12, 13];
          },
          nowMonotonicSeconds: () => 10,
          pathRoot: value.root,
          procRoot: join(value.root, 'proc'),
          readPaths: {
            allow: join(value.root, 'run/baci-cwv-admission/active.json'),
            map: join(value.root, 'opt/baci-cwv/image-process-map.json'),
            release: join(value.root, 'run/baci-cwv-listener-release/release.json'),
          },
        }),
      /process snapshot race/
    );
  } finally {
    rmSync(value.root, { force: true, recursive: true });
  }
});
