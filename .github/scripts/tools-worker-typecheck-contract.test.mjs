import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('the Quality Gate reaches the tools and worker TypeScript project', async () => {
  const pkg = JSON.parse(await readFile('apps/web/package.json', 'utf8'));
  const toolsTsconfig = JSON.parse(await readFile('apps/web/tsconfig.tools-workers.json', 'utf8'));
  const workflow = await readFile('.github/workflows/ci.yml', 'utf8');
  assert.equal(pkg.scripts.typecheck, 'tsc --noEmit && pnpm typecheck:tools-workers');
  assert.equal(pkg.scripts['typecheck:tools-workers'], 'tsc --noEmit -p tsconfig.tools-workers.json');
  assert.deepEqual(toolsTsconfig.compilerOptions.types, [
    'node', 'vitest/globals', '@testing-library/jest-dom', 'google.maps',
  ]);
  assert.deepEqual(toolsTsconfig.include, [
    'tools/events/**/*.ts',
    'tools/db/**/*.ts',
    'src/scripts/process-domain-events.ts',
    'src/scripts/process-domain-events.test.ts',
    'src/scripts/domain-event-worker-message.ts',
    'src/scripts/domain-event-worker-batch.ts',
    'src/scripts/domain-event-worker-batch.test.ts',
    'src/scripts/domain-event-worker.ts',
    'src/scripts/domain-event-worker.test.ts',
    'src/scripts/process-event-deliveries.ts',
    'src/scripts/process-event-deliveries.test.ts',
    'src/scripts/event-delivery-claim-batch-size.ts',
    'src/scripts/event-delivery-claim-batch-size.test.ts',
    'src/scripts/process-claimed-event-delivery.ts',
    'src/scripts/process-claimed-event-delivery.test.ts',
    'src/scripts/event-delivery-worker.ts',
    'src/scripts/event-delivery-worker.test.ts',
  ]);
  assert.ok(!toolsTsconfig.include.includes('tools/**/*.ts'));
  assert.match(workflow, /pnpm turbo typecheck/);
});
