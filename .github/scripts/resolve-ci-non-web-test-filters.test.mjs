import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveNonWebTestFilterArgs } from './resolve-ci-non-web-test-filters.mjs';

test('selects only affected non-web packages for pull-request full test jobs', () => {
  assert.deepEqual(
    resolveNonWebTestFilterArgs({
      baseRef: 'origin/main',
      eventName: 'pull_request',
    }),
    ['--filter=...[origin/main]', '--filter=!@baci/web']
  );
});

test('keeps the non-web filter without narrowing main and merge-queue jobs', () => {
  assert.deepEqual(
    resolveNonWebTestFilterArgs({
      baseRef: 'origin/main',
      eventName: 'merge_group',
    }),
    ['--filter=!@baci/web']
  );
});
