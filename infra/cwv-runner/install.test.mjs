import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const root = new URL('./', import.meta.url);
const read = (name) => readFile(new URL(name, root), 'utf8');
const policyPath = resolve(
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: standalone contract-test fixture input
  process.env.BACI_CWV_POLICY_PATH ?? new URL('policy.json', root).pathname
);
const schemaPath = resolve(
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: standalone contract-test fixture input
  process.env.BACI_CWV_POLICY_SCHEMA_PATH ??
    new URL('policy.schema.mjs', root).pathname
);
// biome-ignore format: compact source cap
const UNIT_NAMES = ['baci-cwv-containerd.service', 'baci-cwv-docker.service', 'baci-cwv-host-sampler.service', 'baci-cwv-host-sampler.timer', 'baci-cwv-measurement.service', 'cwv-measurement-control.slice', 'cwv-measurement.slice'];
// biome-ignore format: compact source cap
const DEPENDENCY_KEYS = 'Requires Wants After Before PartOf Unit Slice'.split(' ');
function section(source, name) {
  const marker = `[${name}]\n`;
  const start = source.indexOf(marker);
  if (start === -1) return '';
  const body = source.slice(start + marker.length);
  const next = body.search(/^\[/m);
  return next === -1 ? body : body.slice(0, next);
}
function values(source, key, targetSection) {
  const body = targetSection ? section(source, targetSection) : source;
  return [...body.matchAll(new RegExp(`^${key}=(.+)$`, 'gm'))].map(
    (match) => match[1]
  );
}
function dependencySet(source) {
  // biome-ignore format: compact source cap
  return [...new Set(DEPENDENCY_KEYS.flatMap((key) => values(source, key).flatMap((value) => value.split(/\s+/).filter(Boolean))))].sort();
}
function durationSeconds(value) {
  const match = /^(\d+)(ms|s|min|m)$/.exec(value);
  assert.ok(match, `bounded duration required, received ${value}`);
  return Number(match[1]) * { ms: 0.001, s: 1, min: 60, m: 60 }[match[2]];
}
async function policy() {
  const { parseRunnerPolicy } = await import(pathToFileURL(schemaPath).href);
  return parseRunnerPolicy(JSON.parse(await readFile(policyPath, 'utf8')));
}
test('dedicated runtime units are isolated, dependency-closed, and bounded', async () => {
  const expected = {
    'baci-cwv-containerd.service': ['cwv-measurement-control.slice'],
    'baci-cwv-docker.service': [
      'baci-cwv-containerd.service',
      'cwv-measurement-control.slice',
    ],
    'baci-cwv-host-sampler.service': ['cwv-measurement-control.slice'],
    'baci-cwv-host-sampler.timer': ['baci-cwv-host-sampler.service'],
    'baci-cwv-measurement.service': [
      'baci-cwv-docker.service',
      'cwv-measurement-control.slice',
      'network-online.target',
    ],
    'cwv-measurement-control.slice': [],
    'cwv-measurement.slice': [],
  };
  for (const name of UNIT_NAMES) {
    const source = await read(name);
    assert.deepEqual(dependencySet(source), expected[name], name);
    // biome-ignore format: compact source cap
    assert.equal(section(source, 'Install'), '', `${name} must remain disabled`);
    assert.doesNotMatch(
      source,
      /(?:^|\s)(?:docker|containerd|actions\.runner\.[^\s]*|baci-deploy)\.service(?:\s|$)|\/(?:var\/run\/docker|run\/containerd\/containerd)\.sock/m
    );
    if (!name.endsWith('.service')) continue;
    const service = section(source, 'Service');
    assert.equal(values(service, 'User')[0], 'root');
    // biome-ignore format: exact sampler-group exception stays under the test cap
    assert.equal(values(service, 'Group')[0], name === 'baci-cwv-host-sampler.service' ? 'baci-cwv' : 'root');
    assert.equal(values(service, 'Restart')[0], 'no');
    assert.equal(values(service, 'NoNewPrivileges')[0], 'true');
    const boundedKeys = ['TimeoutStartSec', 'TimeoutStopSec'];
    if (
      !['baci-cwv-containerd.service', 'baci-cwv-docker.service'].includes(name)
    )
      boundedKeys.push('RuntimeMaxSec');
    for (const key of boundedKeys) {
      const seconds = durationSeconds(values(service, key)[0]);
      assert.ok(seconds > 0 && seconds <= 1800);
    }
    for (const command of values(service, 'ExecStart')) {
      assert.match(command, /^\//);
      assert.ok(
        command.includes(
          '/srv/baci-cwv/sealed/measurement-service-wrapper.sh'
        ) || !/(?:^|\s)(?:\/bin\/(?:sh|bash)|eval)(?:\s|$)/.test(command)
      );
    }
  }
  for (const name of ['baci-cwv-containerd.service', 'baci-cwv-docker.service'])
    assert.equal(
      values(section(await read(name), 'Service'), 'RuntimeMaxSec').length,
      0
    );
});
test('dedicated containerd and Docker use only isolated roots and sockets', async () => {
  const [containerdUnit, dockerUnit, containerdConfig, daemonSource] =
    await Promise.all([
      read('baci-cwv-containerd.service'),
      read('baci-cwv-docker.service'),
      read('containerd.toml'),
      read('daemon.json'),
    ]);
  // biome-ignore format: exact unit command stays under the test cap
  assert.match(containerdUnit, /^ExecStart=\/usr\/bin\/containerd --config \/etc\/baci-cwv\/containerd\.toml$/m);
  assert.match(dockerUnit, /^Requires=baci-cwv-containerd\.service$/m);
  assert.match(dockerUnit, /^After=baci-cwv-containerd\.service$/m);
  // biome-ignore format: exact Docker daemon config path remains a compact contract.
  assert.match(dockerUnit, /^ExecStart=\/usr\/bin\/dockerd --config-file \/etc\/baci-cwv\/daemon\.json$/m);
  assert.match(
    containerdUnit,
    /^RuntimeDirectory=baci-cwv baci-cwv\/containerd$/m
  );
  assert.match(dockerUnit, /^RuntimeDirectory=baci-cwv$/m);
  for (const unit of [containerdUnit, dockerUnit])
    assert.match(unit, /^RuntimeDirectoryPreserve=yes$/m);
  assert.match(
    containerdConfig,
    /^root = "\/srv\/baci-cwv\/containerd\/root"$/m
  );
  assert.match(containerdConfig, /^state = "\/run\/baci-cwv\/containerd"$/m);
  assert.match(
    containerdConfig,
    /^address = "\/run\/baci-cwv\/containerd\/containerd\.sock"$/m
  );
  assert.deepEqual(JSON.parse(daemonSource), {
    bridge: 'none',
    containerd: '/run/baci-cwv/containerd/containerd.sock',
    'data-root': '/srv/baci-cwv/docker',
    'exec-root': '/run/baci-cwv/docker-exec',
    hosts: ['unix:///run/baci-cwv/docker.sock'],
    'ip-forward': false,
    'ip-masq': false,
    iptables: false,
    ipv6: false,
    'live-restore': false,
    'log-driver': 'json-file',
    'log-opts': { 'max-file': '3', 'max-size': '10m' },
    pidfile: '/run/baci-cwv/docker.pid',
    'userland-proxy': false,
  });
  for (const source of [
    containerdUnit,
    dockerUnit,
    containerdConfig,
    daemonSource,
  ])
    assert.doesNotMatch(
      source,
      /\/var\/(?:run\/docker\.sock|lib\/(?:docker|containerd))|\/run\/containerd\/containerd\.sock|tcp:\/\//
    );
});
test('policy schema resources render every isolated CPU and container resource boundary', async () => {
  const [contract, control, measurement, timer, quiesce, wrapper] =
    await Promise.all([
      policy(),
      read('cwv-measurement-control.slice'),
      read('cwv-measurement.slice'),
      read('baci-cwv-host-sampler.timer'),
      read('campaign-quiesce.sh'),
      read('measurement-service-wrapper.sh'),
    ]);
  const { resources, installationImport } = contract;
  // biome-ignore format: exact closed policy projection stays compact
  assert.deepEqual(Object.keys(resources).sort(), ['measurementCpuSet', 'memoryBytes', 'memorySwapBytes', 'otherCpuSet', 'pidsLimit', 'shmBytes']);
  const expectValues = (source, expected) =>
    assert.deepEqual(
      Object.fromEntries(
        Object.keys(expected).map((key) => [key, values(source, key)])
      ),
      Object.fromEntries(
        Object.entries(expected).map(([key, value]) => [key, [String(value)]])
      )
    );
  expectValues(section(control, 'Slice'), {
    AllowedCPUs: installationImport.cpuSet,
    CPUQuota: `${installationImport.cpuQuotaPercent}%`,
    MemoryMax: installationImport.memoryBytes,
    MemorySwapMax: installationImport.memorySwapBytes,
    TasksMax: installationImport.pidsLimit,
    IOWeight: installationImport.ioWeight,
  });
  expectValues(section(measurement, 'Slice'), {
    AllowedCPUs: resources.measurementCpuSet,
    MemoryMax: resources.memoryBytes,
    MemorySwapMax: resources.memorySwapBytes,
    TasksMax: resources.pidsLimit,
  });
  assert.equal(
    values(section(timer, 'Timer'), 'OnUnitInactiveSec')[0],
    `${installationImport.sampleSeconds}s`
  );
  for (const token of [
    `--cpuset-cpus=${resources.measurementCpuSet}`,
    `--memory=${resources.memoryBytes / 2 ** 30}g`,
    `--memory-swap=${(resources.memoryBytes + resources.memorySwapBytes) / 2 ** 30}g`,
    `--pids-limit=${resources.pidsLimit}`,
    `--shm-size=${resources.shmBytes}`,
  ])
    assert.ok(wrapper.includes(token), token);
  assert.match(
    quiesce,
    /measurement_cpu_set=\$\(policy \/resources\/measurementCpuSet\)/
  );
  assert.match(quiesce, /other_cpu_set=\$\(policy \/resources\/otherCpuSet\)/);
  assert.doesNotMatch(quiesce, /(?:AllowedCPUs=|--cpuset-cpus )(?:0-1|2-3)/);
});
test('sampler has no template substitution and executes only sealed local collectors', async () => {
  const [service, timer] = await Promise.all([
    read('baci-cwv-host-sampler.service'),
    read('baci-cwv-host-sampler.timer'),
  ]);
  assert.doesNotMatch(service, /@[A-Z0-9_]+@/);
  assert.deepEqual(values(section(service, 'Service'), 'ExecStart'), [
    `/usr/bin/node /srv/baci-cwv/sealed/host-sample-publisher.mjs live \${BACI_CWV_CAMPAIGN_ID}`,
  ]);
  assert.doesNotMatch(service, /curl|wget|https?:\/\//);
  assert.match(
    service,
    /^EnvironmentFile=\/run\/baci-cwv\/host-sampler\.env$/m
  );
  assert.doesNotMatch(service, /--identity-host|curl|wget|https?:\/\//);
  assert.match(timer, /^OnActiveSec=2s$/m);
  assert.match(timer, /^OnUnitInactiveSec=2s$/m);
  assert.match(timer, /^Persistent=false$/m);
  assert.equal(section(timer, 'Install'), '');
  assert.match(await read('install.sh'), /registration-token-fd\.mjs/);
});

test('installs terminal cleanup as a root-only sealed helper', async () => {
  const installer = await read('install.sh');
  assert.match(
    installer,
    /for name in [^\n]+exact-run-terminal-cleanup\.sh[^\n]+; do\n\s+ensure_file "\$SCRIPT_DIR\/\$name" "\$ROOT\/sealed\/\$name" 0500/
  );
});
