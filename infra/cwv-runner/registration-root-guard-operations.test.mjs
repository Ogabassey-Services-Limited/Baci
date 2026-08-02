import assert from 'node:assert/strict';
import test from 'node:test';

import { dedicatedContainerInventoryArgv } from './registration-root-guard-operations.mjs';

test('uses a full-width Docker container inventory before validating 64-hex IDs', () => {
  assert.deepEqual(
    dedicatedContainerInventoryArgv(['--host=/fixed/docker.sock']),
    [
      '--host=/fixed/docker.sock',
      'container',
      'ls',
      '--all',
      '--no-trunc',
      '--format',
      '{{.ID}}\t{{.Names}}\t{{.State}}',
    ]
  );
});
