import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

test('probe emits only bounded isolation assertions', () => {
  const path = fileURLToPath(new URL('isolation-probe.sh', import.meta.url));
  const source = readFileSync(path, 'utf8');
  assert.doesNotMatch(source, /chrome|Runner\.Listener|curl|wget/i);
  assert.match(source, /id -u/);
  assert.match(source, /id -g/);
  assert.match(source, /cpuset\.cpus\.effective/);
  assert.match(source, /memory\.max/);
  assert.match(source, /memory\.swap\.max/);
  for (const pointer of [
    '/host/runnerUid',
    '/host/runnerGid',
    '/resources/measurementCpuSet',
    '/resources/memoryBytes',
    '/resources/memorySwapBytes',
    '/resources/pidsLimit',
    '/resources/shmBytes',
  ])
    assert.match(source, new RegExp(`policy_get '${pointer}'`));
  assert.doesNotMatch(source, /10001/);
  assert.match(source, /\/dev\/shm/);
  assert.match(source, /pids\.max/);
  assert.match(source, /findmnt/);
  assert.doesNotMatch(source, /FIXTURE|TESTING/);
});

test('probe resource expectations are obtained from the policy accessor', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'cwv-probe-policy-'));
  try {
    for (const name of ['canonical-json.mjs', 'policy.schema.mjs'])
      writeFileSync(
        join(fixture, name),
        readFileSync(new URL(name, import.meta.url))
      );
    const policy = JSON.parse(
      readFileSync(new URL('policy.json', import.meta.url), 'utf8')
    );
    Object.assign(policy.resources, {
      measurementCpuSet: '6-7',
      memoryBytes: 123456789,
      memorySwapBytes: 12,
      pidsLimit: 34,
      shmBytes: 56,
    });
    Object.assign(policy.host, { runnerGid: 79, runnerUid: 78 });
    writeFileSync(join(fixture, 'policy.json'), JSON.stringify(policy));
    const values = [
      ['/host/runnerUid', '78'],
      ['/host/runnerGid', '79'],
      ['/resources/measurementCpuSet', '6-7'],
      ['/resources/memoryBytes', '123456789'],
      ['/resources/memorySwapBytes', '12'],
      ['/resources/pidsLimit', '34'],
      ['/resources/shmBytes', '56'],
    ];
    for (const [pointer, expected] of values) {
      const output = execFileSync(
        process.execPath,
        [realpathSync(join(fixture, 'policy.schema.mjs')), 'get', pointer],
        { encoding: 'utf8' }
      );
      assert.equal(output, `${expected}\n`, pointer);
    }
  } finally {
    rmSync(fixture, { force: true, recursive: true });
  }
});
