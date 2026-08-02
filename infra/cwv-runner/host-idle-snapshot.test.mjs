import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { readSnapshot } from './host-idle-snapshot.mjs';

test('excludes guest counters already represented in user and nice CPU time', async () => {
  const root = await mkdtemp(join(tmpdir(), 'baci-idle-snapshot-'));
  const point = join(root, 'start');
  try {
    await mkdir(point);
    await Promise.all([
      writeFile(join(point, 'stat'), 'cpu 1 2 3 4 5 6 7 8 90 100\n'),
      writeFile(join(point, 'monotonic'), '1\n'),
      writeFile(join(point, 'monotonic-end'), '2\n'),
      writeFile(join(point, 'loadavg'), '0.1 0.2 0.3 1/2 3\n'),
      writeFile(join(point, 'meminfo'), 'MemAvailable: 1 kB\n'),
      writeFile(join(point, 'rootfs'), '1 1\n'),
    ]);

    const snapshot = readSnapshot(root, 'start');

    assert.equal(snapshot.cpu.total, 36n);
    assert.equal(snapshot.cpu.steal, 8n);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
