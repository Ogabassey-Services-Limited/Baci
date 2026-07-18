import { describe, expect, it } from 'vitest';
import { isTestSourcePath } from './event-pipeline-source-path';

describe('isTestSourcePath', () => {
  it.each([
    'worker.test.js',
    'worker.spec.jsx',
    'worker.test.cjs',
    'worker.test.ts',
    'worker.spec.tsx',
    'worker.test.mjs',
    'worker.spec.mjs',
    'worker.test.mts',
    'worker.spec.cts',
  ])('recognizes %s', (path) => {
    expect(isTestSourcePath(path)).toBe(true);
  });

  it('keeps production modules classified as production', () => {
    expect(isTestSourcePath('worker.ts')).toBe(false);
  });
});
