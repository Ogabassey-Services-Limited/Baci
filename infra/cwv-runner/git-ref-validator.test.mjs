import assert from 'node:assert/strict';
import test from 'node:test';

import { validGitRef } from './git-ref-validator.mjs';

test('accepts safe Git refs and rejects Git-invalid components', () => {
  assert.equal(validGitRef('release/2026.08'), true);
  for (const value of [
    'release//candidate',
    'release/.hidden',
    'release.lock',
    'release/',
    'release..',
    '-release',
    '/release',
    'release/@{bad}',
  ])
    assert.equal(validGitRef(value), false, value);
});
