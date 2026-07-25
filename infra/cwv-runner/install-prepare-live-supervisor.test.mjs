import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  assertDedicatedProcessPlacement,
  atomicJson,
  normalizeFirewall,
  parsePsiFullAvg10,
  watchPrepare,
} from './install-prepare-live-supervisor.mjs';

const source = await readFile(
  new URL('./install-prepare-live-supervisor.mjs', import.meta.url),
  'utf8'
);
const cli = await readFile(
  new URL('./install-prepare-live-supervisor-cli.mjs', import.meta.url),
  'utf8'
);
const policy = JSON.parse(
  await readFile(new URL('./policy.json', import.meta.url), 'utf8')
);

test('normalizes only mutable firewall counters while retaining rule identity', () => {
  assert.equal(
    normalizeFirewall('counter packets 42 bytes 900 accept\nmark 0x12\n'),
    'counter packets # bytes # accept\nmark 0x12'
  );
});

test('parses the measured full pressure average and rejects incomplete input', () => {
  assert.equal(
    parsePsiFullAvg10(
      'some avg10=1.20 avg60=0 avg300=0 total=1\nfull avg10=0.05 avg60=0 avg300=0 total=2\n'
    ),
    0.05
  );
  assert.throws(() => parsePsiFullAvg10('some avg10=0.1'), /pressure/);
});

test('requires every dedicated process marker to remain in the control slice', () => {
  assert.doesNotThrow(() =>
    assertDedicatedProcessPlacement([
      {
        pid: 10,
        executable: '/usr/bin/dockerd',
        cgroup: '0::/cwv-measurement-control.slice/baci-cwv-docker.service',
        command: '/usr/bin/dockerd --config-file /etc/baci-cwv/daemon.json',
      },
    ])
  );
  assert.throws(
    () =>
      assertDedicatedProcessPlacement([
        {
          pid: 11,
          executable: '/usr/bin/docker',
          cgroup: '/user.slice',
          command:
            '/usr/bin/docker --host unix:///run/baci-cwv/docker.sock load',
        },
      ]),
    /outside control slice/
  );
  assert.throws(
    () =>
      assertDedicatedProcessPlacement([
        {
          pid: 12,
          executable: '/usr/bin/dockerd',
          cgroup:
            '0::/foreign.slice/cwv-measurement-control.slice/baci-cwv-docker.service',
          command: '/usr/bin/dockerd --config-file /etc/baci-cwv/daemon.json',
        },
      ]),
    /outside control slice/
  );
  assert.throws(
    () =>
      assertDedicatedProcessPlacement([
        {
          pid: 13,
          executable: '/usr/bin/dockerd',
          cgroup:
            '0::/cwv-measurement-control.slice/baci-cwv-docker.service\n0::/foreign.slice',
          command: '/usr/bin/dockerd --config-file /etc/baci-cwv/daemon.json',
        },
      ]),
    /outside control slice/
  );
});

test('collects only passive host state and never contacts a production daemon', () => {
  assert.doesNotMatch(source, /command\(['"]\/usr\/bin\/(?:docker|containerd)/);
  assert.match(source, /PREPARE_SAMPLE_SECONDS = 2/);
  assert.match(source, /prepare sample interval drift/);
  assert.match(source, /\/proc\/pressure\/(?:cpu|memory|io)/);
  assert.match(source, /CONTROL = \/\^0::/);
  assert.match(source, /CONTROL\.test\(row\.cgroup\)/);
  assert.match(source, /production container absent/);
  assert.equal(policy.installationImport.sampleSeconds, 2);
});

test('CLI rejects malformed commands and signals only its original parent instance', () => {
  assert.match(cli, /usage: live-supervisor watch/);
  assert.match(cli, /parentPid > 1 &&/);
  assert.match(cli, /currentStartTime\(parentPid\) === parentStart/);
  assert.match(cli, /readFileSync\(`\/proc\/\$\{pid\}\/stat`/);
});

test('refuses a supervisor directory that already exists', async () => {
  let reads = 0;

  await assert.rejects(
    () =>
      watchPrepare(
        'prepare-collision',
        '/capture.json',
        'a'.repeat(64),
        '/policy.json',
        '/already-there',
        {
          mkdir: () => {
            const error = new Error('exists');
            error.code = 'EEXIST';
            throw error;
          },
          readFile: () => {
            reads += 1;
            return Buffer.from('unexpected');
          },
        }
      ),
    /exists/
  );
  assert.equal(reads, 0);
});

test('retries a colliding temporary receipt name before atomically publishing', async () => {
  const opened = [];
  const written = [];
  let ids = 0;
  const handle = {
    writeFile(value) {
      written.push(value);
      return Promise.resolve();
    },
    sync: () => Promise.resolve(),
    close: () => Promise.resolve(),
  };

  await atomicJson(
    '/receipts/supervisor-ready.json',
    { ready: true },
    {
      randomId: () => (ids++ === 0 ? 'collision' : 'fresh'),
      openFile: (path) => {
        opened.push(path);
        if (path.endsWith('.collision.tmp')) {
          const error = new Error('exists');
          error.code = 'EEXIST';
          throw error;
        }
        return handle;
      },
      renameFile: (from, to) => opened.push(`${from}->${to}`),
    }
  );

  assert.deepEqual(opened, [
    '/receipts/.collision.tmp',
    '/receipts/.fresh.tmp',
    '/receipts/.fresh.tmp->/receipts/supervisor-ready.json',
    '/receipts',
  ]);
  assert.deepEqual(written, ['{"ready":true}\n']);
});

test('refuses an initial dedicated worker inventory before writing ready receipt', async () => {
  const capture = Buffer.from(
    '{"host":{"bootId":"boot"},"priorState":{"resources":{"runners":[],"timers":[],"slices":[],"containers":[]}}}'
  );
  const policyValue = JSON.stringify({
    installationImport: { sampleSeconds: 2 },
    thresholds: {},
  });
  let writes = 0;

  await assert.rejects(
    () =>
      watchPrepare(
        'prepare-workers',
        '/capture.json',
        createHash('sha256').update(capture).digest('hex'),
        '/policy.json',
        '/fresh',
        {
          mkdir: () => undefined,
          readFile: (path) =>
            Promise.resolve(path === '/capture.json' ? capture : policyValue),
          snapshot: () => ({
            production: 'production',
            firewall: 'firewall',
            workers: [{ pid: 123 }],
          }),
          atomicJson: () => {
            writes += 1;
          },
        }
      ),
    /dedicated workers present before prepare/
  );
  assert.equal(writes, 0);
});
