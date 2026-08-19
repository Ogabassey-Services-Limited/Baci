import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('./is-dep-less-worktree.sh', import.meta.url),
  'utf8'
);

test('delegates to sparse checkout detection', () => {
  assert.match(source, /is-sparse-checkout\.sh/);
});

test('detects linked node_modules worktrees', () => {
  assert.match(source, /-L "\$root\/node_modules"/);
});
