import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('keeps the replacement controller as an aggregation-only barrel', async () => {
  const [source, controller] = await Promise.all([
    readFile(
      new URL(
        './install-bootstrap-replacement-controller.mjs',
        import.meta.url
      ),
      'utf8'
    ),
    import('./install-bootstrap-replacement-controller.mjs'),
  ]);
  assert.doesNotMatch(source, /export async function/);
  assert.deepEqual(Object.keys(controller).sort(), [
    'authorizeBootstrapReplacement',
    'authorizeBootstrapReplacementIfNeeded',
    'completeBootstrapReplacement',
    'persistBootstrapReplacementIntent',
    'persistBootstrapReplacementReceipt',
    'readBootstrapReplacementDownstream',
    'readBootstrapReplacementIntent',
    'readBootstrapReplacementReceipt',
    'verifyBootstrapReplacementCompletion',
  ]);
});
