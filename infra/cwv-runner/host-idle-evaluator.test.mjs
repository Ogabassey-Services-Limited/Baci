import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  fixture,
  runtime,
  thresholds,
} from './host-idle-evaluator.fixture.mjs';
import { evaluateIdleSample } from './host-idle-evaluator.mjs';

test('sampler uses policy-derived timeouts and a closed Docker projection', async () => {
  const source = await readFile(
    new URL('./host-idle-check.sh', import.meta.url),
    'utf8'
  );
  assert.doesNotMatch(source, /Config\.(?:Labels|Env)/);
  assert.doesNotMatch(source, /probe-image-id|sealed\/image-id/);
  assert.match(source, /\/srv\/baci-cwv\/image-id/);
  assert.match(source, /\/srv\/baci-cwv\/receipts\/image-process-map\.json/);
  assert.match(source, /image-process-map\.sha256/);
  assert.match(source, /map = file\(mapPath, 0o400\)/);
  assert.match(source, /mapDigest = file\(mapDigestPath, 0o400\)/);
  assert.match(source, /canonical\(image\.processMap\) !== map\.toString/);
  assert.match(source, /\/srv\/baci-cwv\/sealed\/identity-contract\.json/);
  assert.match(source, /unix:\/\/\/run\/docker\.sock/);
  assert.match(source, /registrationProbeTimeoutSeconds/);
  assert.match(source, /--format "\$DOCKER_PROJECTION"/);
  assert.match(source, /monotonic-end/);
  assert.match(source, /wait_for_bracket/);
  assert.match(source, /cpuset\.cpus\.effective/);
  const evaluator = await readFile(
    new URL('./host-idle-evaluator.mjs', import.meta.url),
    'utf8'
  );
  assert.equal(
    (evaluator.match(/evidenceDigests\(root, 'start'\)/g) ?? []).length,
    1
  );
  assert.equal(
    (evaluator.match(/evidenceDigests\(root, 'end'\)/g) ?? []).length,
    1
  );
});

test('refuses a process map whose separate receipt digest does not bind its full object', async () => {
  const input = await fixture();
  const authority = structuredClone(runtime(input, 'live').processAuthority);
  authority.processMapSha256 = '0'.repeat(64);
  assert.throws(
    () =>
      evaluateIdleSample({
        ...input,
        mode: 'live',
        thresholds,
        runtime: { ...runtime(input, 'live'), processAuthority: authority },
      }),
    /process authority/
  );
});

test('refuses a sample without sealed process authority', async () => {
  const input = await fixture();
  assert.throws(
    () =>
      evaluateIdleSample({
        ...input,
        mode: 'live',
        thresholds,
        runtime: { ...runtime(input, 'live'), processAuthority: undefined },
      }),
    /process authority/
  );
});

test('accepts approved dedicated control helpers during rehearsal', async () => {
  const input = await fixture({ mode: 'rehearsal' });
  assert.doesNotThrow(() =>
    evaluateIdleSample({
      ...input,
      mode: 'rehearsal',
      thresholds,
      runtime: runtime(input, 'rehearsal'),
    })
  );
});

test('refuses external browser work and production containers outside CPUs 0-1', async () => {
  for (const [file, value, expected] of [
    [
      'end/processes',
      `99|1|/opt/google/chrome/chrome|${'f'.repeat(64)}|/system.slice/foreign.service|0-1|/usr/lib/systemd/systemd|${'9'.repeat(64)}\n`,
      'external runner process',
    ],
    [
      'end/production-applications',
      `${'e'.repeat(64)}|true|2-3\n`,
      'production application cpuset',
    ],
  ]) {
    const input = await fixture();
    await writeFile(path.join(input.root, file), value);
    assert.throws(
      () =>
        evaluateIdleSample({
          ...input,
          mode: 'live',
          thresholds,
          runtime: runtime(input, 'live'),
        }),
      new RegExp(expected)
    );
  }
});

test('accepts a complete low-pressure interval with exact accounting selectors', async () => {
  const input = await fixture();
  const result = evaluateIdleSample({
    ...input,
    mode: 'live',
    thresholds,
    runtime: runtime(input, 'live'),
  });
  assert.equal(result.accepted, true);
  assert.equal(result.evidence.boundaries.elapsedNanoseconds, '10000000000');
  assert.equal(result.evidence.captureSha256, 'e'.repeat(64));
});

test('refuses malformed timing, a foreign marked tuple, selector drift, and second listener', async () => {
  for (const [file, mutate, expected] of [
    ['end/monotonic', '10000000001\n', 'sample interval'],
    [
      'end/conntrack',
      'ipv4 src=10.0.0.2 dst=1.1.1.1 mark=0xb0000001\n',
      'conntrack runner tuple',
    ],
    [
      'end/conntrack',
      'ipv4 2 tcp 6 src=172.31.0.2 dst=1.1.1.1 src=1.1.1.1 dst=172.31.0.2 mark=0xb0000001\n',
      'conntrack runner tuple',
    ],
    ['end/nft', JSON.stringify({ nftables: [] }), 'accounting table'],
    [
      'end/processes',
      `10|1|/usr/bin/dockerd|${'a'.repeat(64)}|/cwv-measurement-control.slice/baci-cwv-docker.service|2-3|/usr/lib/systemd/systemd|-\n11|1|/usr/bin/containerd|${'b'.repeat(64)}|/cwv-measurement-control.slice/baci-cwv-containerd.service|2-3|/usr/lib/systemd/systemd|-\n41|1|/opt/node/bin/node|${'c'.repeat(64)}|/cwv-measurement.slice/docker-${'a'.repeat(64)}.scope|2-3|/usr/lib/systemd/systemd|-\n42|41|/opt/runner/bin/Runner.Listener|${'d'.repeat(64)}|/cwv-measurement.slice/docker-${'a'.repeat(64)}.scope|2-3|/opt/node/bin/node|${'c'.repeat(64)}\n43|42|/opt/runner/bin/Runner.Worker|${'e'.repeat(64)}|/cwv-measurement.slice/docker-${'a'.repeat(64)}.scope|2-3|/opt/runner/bin/Runner.Listener|${'d'.repeat(64)}\n`,
      'measurement process cardinality',
    ],
    [
      'end/processes',
      `10|1|/usr/bin/dockerd|${'a'.repeat(64)}|/cwv-measurement-control.slice/baci-cwv-docker.service|2-3|/usr/lib/systemd/systemd|-\n11|1|/usr/bin/containerd|${'b'.repeat(64)}|/cwv-measurement-control.slice/baci-cwv-containerd.service|2-3|/usr/lib/systemd/systemd|-\n`,
      'measurement process cardinality',
    ],
    [
      'end/processes',
      `11|1|/usr/bin/containerd|${'b'.repeat(64)}|/cwv-measurement-control.slice/baci-cwv-containerd.service|2-3|/usr/lib/systemd/systemd|-\n41|1|/opt/node/bin/node|${'c'.repeat(64)}|/cwv-measurement.slice/docker-${'a'.repeat(64)}.scope|2-3|/usr/lib/systemd/systemd|-\n42|41|/opt/runner/bin/Runner.Listener|${'d'.repeat(64)}|/cwv-measurement.slice/docker-${'a'.repeat(64)}.scope|2-3|/opt/node/bin/node|${'c'.repeat(64)}\n`,
      'control process cardinality',
    ],
  ]) {
    const input = await fixture();
    await writeFile(path.join(input.root, file), mutate);
    assert.throws(
      () =>
        evaluateIdleSample({
          ...input,
          mode: 'live',
          thresholds,
          runtime: runtime(input, 'live'),
        }),
      new RegExp(expected)
    );
  }
});

test('rehearsal requires the exact, running network-none probe at both boundaries', async () => {
  const input = await fixture({ mode: 'rehearsal' });
  assert.doesNotThrow(() =>
    evaluateIdleSample({
      ...input,
      mode: 'rehearsal',
      thresholds,
      runtime: runtime(input, 'rehearsal'),
    })
  );
  const projection = JSON.parse(
    await readFile(path.join(input.root, 'end/runner'), 'utf8')
  );
  projection[4] = 'bridge';
  await writeFile(
    path.join(input.root, 'end/runner'),
    JSON.stringify(projection)
  );
  assert.throws(
    () =>
      evaluateIdleSample({
        ...input,
        mode: 'rehearsal',
        thresholds,
        runtime: runtime(input, 'rehearsal'),
      }),
    /rehearsal probe/
  );
});

test('refuses every normal service projection drift', async () => {
  const drift = [
    ['wrong bind', (value) => (value[16][0] = `${value[16][0]}:z`)],
    [
      'extra bind',
      (value) => value[16].push('/srv/baci-cwv/writable/extra:/extra:rw'),
    ],
    [
      'wrong tmpfs',
      (value) =>
        (value[18]['/tmp'] = 'rw,noexec,nosuid,nodev,size=16777216,mode=1777'),
    ],
    ['wrong image id', (value) => (value[1] = `sha256:${'d'.repeat(64)}`)],
  ];
  for (const [, mutate] of drift) {
    const live = await fixture();
    const file = path.join(live.root, 'end/runner');
    const liveProjection = JSON.parse(await readFile(file, 'utf8'));
    mutate(liveProjection);
    await writeFile(file, JSON.stringify(liveProjection));
    assert.throws(
      () =>
        evaluateIdleSample({
          ...live,
          mode: 'live',
          thresholds,
          runtime: runtime(live, 'live'),
        }),
      /runner policy/
    );
  }

  const rehearsal = await fixture({ mode: 'rehearsal' });
  await writeFile(
    path.join(rehearsal.root, 'end/processes'),
    `10|1|/usr/bin/dockerd|${'a'.repeat(64)}|/cwv-measurement-control.slice/baci-cwv-docker.service|2-3|/usr/lib/systemd/systemd|-\n11|1|/usr/bin/containerd|${'b'.repeat(64)}|/cwv-measurement-control.slice/baci-cwv-containerd.service|2-3|/usr/lib/systemd/systemd|-\n42|1|/opt/runner/bin/Runner.Listener|${'d'.repeat(64)}|/cwv-measurement.slice/docker-${'b'.repeat(64)}.scope|2-3|/usr/lib/systemd/systemd|-\n`
  );
  assert.throws(
    () =>
      evaluateIdleSample({
        ...rehearsal,
        mode: 'rehearsal',
        thresholds,
        runtime: runtime(rehearsal, 'rehearsal'),
      }),
    /rehearsal process identity/
  );
});
