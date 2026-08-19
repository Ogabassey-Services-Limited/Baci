import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('./resolve-turbo-cmd.sh', import.meta.url),
  'utf8'
);

test('emits TURBO_CMD and FILTERS sentinel tokens', () => {
  assert.match(source, /---TURBO_CMD---/);
  assert.match(source, /---FILTERS---/);
});

test('requires ACTIVE_DIR environment variable', () => {
  assert.match(source, /ACTIVE_DIR.*must be set/);
});

test('checks for dep-less worktree before configuring pnpm', () => {
  assert.match(source, /is-dep-less-worktree\.sh/);
});

test('prefers local turbo binary over pnpm turbo', () => {
  assert.match(source, /node_modules\/\.bin\/turbo/);
});
