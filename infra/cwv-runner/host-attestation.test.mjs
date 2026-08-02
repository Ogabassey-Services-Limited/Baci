import assert from 'node:assert/strict';
import { copyFile, mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { validateSealedRunnerIdentity } from './host-attestation.mjs';

const read = (name) => readFile(new URL(name, import.meta.url), 'utf8');

test('host collector exposes only the identity and local-live entry points', async () => {
  const source = await read('./host-attest.sh');
  assert.match(source, /--identity-host\|--live-local/);
  assert.match(
    source,
    /usage: host-attest\.sh --identity-host\|--live-local <campaign-id>/
  );
  assert.match(source, /\^\[a-z0-9\]\[a-z0-9-\]\{0,62\}\$/);
  assert.doesNotMatch(source, /--rehearsal-local/);
  assert.match(source, /case "\$mode" in[\s\S]*identity-host[\s\S]*live-local/);
});

test('identity collection pins a sterile external curl invocation', async () => {
  const source = await read('./host-attest.sh');
  assert.ok(source.includes('/usr/bin/env -i \\'));
  assert.match(
    source,
    /PATH=\/usr\/local\/sbin:[\s\S]*HOME=\/var\/empty\/baci-cwv/
  );
  for (const value of [
    '-q',
    '--config /dev/null',
    "--noproxy '*'",
    "--proto '=https'",
    '--tlsv1.2',
    '--cacert /etc/ssl/certs/ca-certificates.crt',
    '--max-time 10',
    'https://www.cloudflare.com/cdn-cgi/trace',
    'https://rdap.db.ripe.net/ip/82.29.190.219',
  ])
    assert.ok(source.includes(value), value);
  assert.doesNotMatch(source, /--location/);
  assert.match(source, /assert_empty_root_home/);
  assert.match(source, /reject_stderr/);
  const rdap = source.indexOf('external_read "$temporary/rdap"');
  assert(rdap > 0, 'RDAP transaction must be present');
  assert.match(
    source.slice(rdap),
    /ip-forward-after-rdap[\s\S]*ip forwarding drift/
  );
  assert.match(source, /scaling_governor/);
  assert.match(source, /energy_performance_preference/);
  assert.match(source, /iptables-nft/);
  assert.match(
    source,
    /env -i[\s\S]*docker --host unix:\/\/\/run\/baci-cwv\/docker\.sock info/
  );
});

test('live collector is locally constrained and binds the campaign accounting state', async () => {
  const source = await read('./host-attest.sh');
  const live = source.slice(source.indexOf('live_local()'));
  for (const value of [
    '/proc/sys/net/ipv4/ip_forward',
    'docker --host unix:///run/baci-cwv/docker.sock',
    'nft --json --handle list table',
    'accounting-identity.json',
  ])
    assert.ok(live.includes(value), value);
  assert.match(
    live,
    /inspect --format '\[\{\{json \.Id\}\},\{\{json \.Image\}\}/
  );
  assert.match(live, /capture digest mismatch/);
  assert.match(live, /const canonical=/);
  assert.doesNotMatch(
    live,
    /Config\.Env|\.Config\.Labels|live-pressure|pressureSha256/
  );
  assert.doesNotMatch(live, /\b(?:curl|wget|gh|resolvectl|hostname)\b/);
  assert.match(source, /sha256sum/);
});

test('live collector binds a currently running runner and its classifier identity', async () => {
  const source = await read('./host-attest.sh');
  const live = source.slice(source.indexOf('live_local()'));
  for (const value of [
    '/srv/baci-cwv/image-id',
    '/srv/baci-cwv/image-id.sha256',
    '{{json .State.Running}}',
    '{{json .HostConfig.CgroupParent}}',
    '{{json .NetworkSettings.Networks}}',
    '/proc/$runner_pid/cgroup',
    'classify-measurement',
    'live host identity drift',
    'runner image drift',
    'runner image receipt drift',
    'runner network drift',
    'runner cgroup drift',
    'classifier drift',
  ])
    assert.ok(live.includes(value), value);
  assert.match(live, /runnerContainerId.*liveIdentity/);
  assert.match(live, /classifier:\{handle:classifier\.handle,sha256/);
});

test('collector bounds internal commands and uses exact sibling policy and identity contracts', async () => {
  const source = await read('./host-attest.sh');
  assert.match(source, /readonly COMMAND_TIMEOUT=15s/);
  assert.match(
    source,
    /\/usr\/bin\/timeout --signal=TERM --kill-after=1s "\$COMMAND_TIMEOUT"/
  );
  assert.match(source, /identity-contract\.json/);
  assert.match(source, /policy\.json/);
  assert.match(source, /policy\.schema\.mjs/);
  assert.match(source, /control_evidence[\s\S]*Runner\.Listener/);
  assert.match(source, /\[ -f "\$runner" \] && \[ ! -L "\$runner" \]/);
  assert.match(source, /runner binary ownership/);
  for (const binary of [
    '/usr/bin/dockerd',
    '/usr/bin/containerd',
    '/usr/sbin/nft',
    '/usr/sbin/xtables-nft-multi',
  ])
    assert.match(source, new RegExp(`assert_root_binary ${binary}`));
  assert.match(source, /CPUQuotaPerSecUSec,IOWeight,MemoryMax/);
  assert.match(source, /CPUAccounting,IOAccounting,MemoryAccounting,MemoryMax/);
  assert.match(
    source,
    /cpuset\.cpus\.effective cpu\.max io\.weight memory\.max memory\.swap\.max pids\.max/
  );
});

test('host attestation accepts only the sealed runner projection and its least-privilege modes', async () => {
  const source = await read('./host-attest.sh');
  assert.match(source, /assert_sealed_runner_projection/);
  assert.match(source, /runner-runtime-projection\.mjs/);
  assert.match(source, /readRunnerRuntimeManifest/);
  assert.match(source, /inspectRunnerProjection/);
  assert.match(source, /\/srv\/baci-cwv\/sealed\/actions-runner/);
  assert.doesNotMatch(source, /expected=':d[\s\S]*entrypoint\.mjs:f'/);
});

// biome-ignore format: source assertions preserve the test file cap.
test('host identity uses sealed minimal identity, not raw RunnerSettings', async () => {
  const [source, builder] = await Promise.all([read('./host-attest.sh'), read('./host-attestation-builder.test.mjs')]);
  assert.match(source, /sealed\/runner-identity\.json/);
  assert.match(source, /validateSealedRunnerIdentity/);
  assert.doesNotMatch(source, /JSON\.parse\(fs\.readFileSync\(`\$\{runnerRoot\}\/\.runner/);
  assert.match(builder, /generation: 1,[\s\S]*id: 41,[\s\S]*name: 'baci-cwv-measurement-01'/);
  assert.doesNotMatch(builder, /agentId: 41|serverUrl: github\.repository\.url|workFolder: '_work'/);
});

// biome-ignore format: compact fail-closed matrix is clearer as one fixture.
test('sealed runner identity fails closed for RunnerSettings, metadata, canonicality, and drift', async () => {
  const contract = JSON.parse(await read('./identity-contract.json'));
  const encode = (value) => Buffer.from(JSON.stringify(value));
  const valid = Buffer.from('{"generation":1,"id":41,"name":"baci-cwv-measurement-01"}');
  const details = { gid: 10001, isFile: () => true, isSymbolicLink: () => false, mode: 0o100400, nlink: 1, uid: 0 };
  const receipt = validateSealedRunnerIdentity({ bytes: valid, details, identityContract: contract });
  assert.deepEqual(receipt.identity, { generation: 1, id: 41, name: 'baci-cwv-measurement-01' });
  assert.match(receipt.sha256, /^[a-f0-9]{64}$/);
  for (const value of [
    undefined,
    { ...details, isFile: () => false },
    { ...details, isSymbolicLink: () => true },
    { ...details, mode: 0o100600 },
    { ...details, uid: 10001 },
    { ...details, gid: 0 },
    { ...details, nlink: 2 },
  ]) assert.throws(() => validateSealedRunnerIdentity({ bytes: valid, details: value, identityContract: contract }));
  for (const bytes of [
    encode({ agentId: 41, agentName: 'baci-cwv-measurement-01', serverUrl: 'https://github.com/ogabasseyy/Baci', workFolder: '_work' }),
    Buffer.from('{"name":"baci-cwv-measurement-01","id":41,"generation":1}'),
    encode({ generation: 1, id: 41, name: 'baci-cwv-measurement-01', extra: true }),
    encode({ generation: 2, id: 41, name: 'baci-cwv-measurement-01' }),
    encode({ generation: 1, id: 0, name: 'baci-cwv-measurement-01' }),
    encode({ generation: 1, id: 41, name: 'drifted' }),
  ]) assert.throws(() => validateSealedRunnerIdentity({ bytes, details, identityContract: contract }));
});

test('normalizer accepts the exact Task 1 policy fixture after a sibling copy', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cwv-policy-fixture-'));
  await Promise.all([
    copyFile(
      new URL('./policy.json', import.meta.url),
      path.join(root, 'policy.json')
    ),
    copyFile(
      new URL('./policy.schema.mjs', import.meta.url),
      path.join(root, 'policy.schema.mjs')
    ),
  ]);
  const policy = JSON.parse(
    await readFile(path.join(root, 'policy.json'), 'utf8')
  );
  assert.equal(policy.supplyChain.runner.version, '2.335.1');
  assert.match(policy.supplyChain.runner.sha256, /^[a-f0-9]{64}$/);
});

test('idle checker has exactly live and rehearsal lanes with local counter arithmetic', async () => {
  const [source, evaluator, snapshot] = await Promise.all([
    read('./host-idle-check.sh'),
    read('./host-idle-evaluator.mjs'),
    read('./host-idle-snapshot.mjs'),
  ]);
  assert.match(source, /--live-local[^\n]*\|--rehearsal-local/);
  assert.match(
    source,
    /usage: host-idle-check\.sh --live-local <campaign-id>\|--rehearsal-local <campaign-id> <probe-container-id>/
  );
  assert.match(source, /\^\[a-z0-9\]\[a-z0-9-\]\{0,62\}\$/);
  assert.match(source, /NetworkMode/);
  assert.match(source, /--network=none/);
  assert.match(source, /networkSampleSeconds/);
  assert.match(evaluator, /ambientIngressBytes/);
  assert.match(evaluator, /ambientEgressBytes/);
  assert.match(snapshot, /BigInt/);
  assert.doesNotMatch(source, /\b(?:curl|wget|gh|resolvectl|hostname)\b/);
});

test('idle checker delegates strict arithmetic to the colocated evaluator', async () => {
  const [source, evaluator, snapshot] = await Promise.all([
    read('./host-idle-check.sh'),
    read('./host-idle-evaluator.mjs'),
    read('./host-idle-snapshot.mjs'),
  ]);
  assert.match(source, /host-idle-evaluator\.mjs/);
  assert.match(source, /proc\/pressure\/\$resource/);
  assert.match(source, /\/proc\/net\/nf_conntrack/);
  assert.match(source, /\/sys\/class\/net\/\$interface/);
  assert.match(
    evaluator,
    /threshold\(load1PerCpu, thresholds\.load1Max, 'load1'\)/
  );
  assert.match(evaluator, /pressureFull\(root, `end\/\$\{name\}`\)/);
  assert.match(snapshot, /rehearsal measurement counter/);
  assert.match(snapshot, /BigInt/);
});
