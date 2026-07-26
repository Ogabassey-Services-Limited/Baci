import assert from 'node:assert/strict';
import { appendFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { fixture, runtime } from './host-idle-evaluator.fixture.mjs';
import { assertProcesses } from './host-idle-process-authority.mjs';

test('refuses a second otherwise valid dockerd process', async (context) => {
  const input = await fixture();
  context.after(() => rm(input.root, { force: true, recursive: true }));
  const duplicate = `12|1|/usr/bin/dockerd|${'a'.repeat(64)}|/cwv-measurement-control.slice/baci-cwv-docker.service|2-3|/usr/lib/systemd/systemd|-\n`;
  await appendFile(join(input.root, 'start', 'processes'), duplicate);

  assert.throws(
    () =>
      assertProcesses(
        input.root,
        'start',
        runtime(input, 'live'),
        input.resources,
        'live'
      ),
    /control process cardinality/
  );
});
