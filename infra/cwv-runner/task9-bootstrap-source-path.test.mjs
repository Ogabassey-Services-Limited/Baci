import assert from 'node:assert/strict';
import test from 'node:test';

import { validSourcePath } from './task9-bootstrap.mjs';

test('accepts the complete safe source path character set', () => {
  assert.equal(validSourcePath('infra/cwv-runner/helper+v2.mjs'), true);
  assert.equal(validSourcePath('infra/cwv-runner/helper v2.mjs'), false);
});
