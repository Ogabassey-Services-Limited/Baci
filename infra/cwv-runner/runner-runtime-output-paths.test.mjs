import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { assertDistinctRunnerRuntimeOutputs } from './runner-runtime-output-paths.mjs';

const root = path.resolve('/tmp', 'runner-runtime-output-paths');

test('refuses equal receipt and projection output directories', () => {
  assert.throws(
    () => assertDistinctRunnerRuntimeOutputs(root, root),
    /runner runtime output paths refused/
  );
});

test('refuses a receipt directory that is an ancestor of projection', () => {
  assert.throws(
    () =>
      assertDistinctRunnerRuntimeOutputs(root, path.join(root, 'projection')),
    /runner runtime output paths refused/
  );
});

test('refuses a projection directory that is an ancestor of receipt', () => {
  assert.throws(
    () => assertDistinctRunnerRuntimeOutputs(path.join(root, 'receipt'), root),
    /runner runtime output paths refused/
  );
});

test('allows sibling receipt and projection output directories', () => {
  assert.doesNotThrow(() =>
    assertDistinctRunnerRuntimeOutputs(
      path.join(root, 'receipt'),
      path.join(root, 'projection')
    )
  );
});
