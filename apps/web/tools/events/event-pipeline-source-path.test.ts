import { describe, expect, it } from 'vitest';
import { isTestSourcePath } from './event-pipeline-source-path';

describe('isTestSourcePath', () => {
  it.each([
    'worker.test.ts',
    'worker.spec.tsx',
    'worker.test.mjs',
    'worker.spec.mjs',
  ])('recognizes %s', (path) => {
    expect(isTestSourcePath(path)).toBe(true);
  });

  it('keeps production modules classified as production', () => {
    expect(isTestSourcePath('worker.ts')).toBe(false);
  });
});
