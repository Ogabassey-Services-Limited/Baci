import { describe, expect, it } from 'vitest';
import { analyzeChangedRuntimeContracts } from './verify-analytics-delivery-authority';

describe('changed analytics runtime review regressions', () => {
  it('does not require a colocated test for a pure runtime barrel', () => {
    const path = 'apps/web/src/lib/analytics/index.ts';
    const sources = new Map([[path, "export { send } from './send';"]]);
    expect(analyzeChangedRuntimeContracts([path], sources)).toEqual([]);
  });

  it.each([
    'fixture.test.ts',
    'fixture.spec.tsx',
    'fixture.test.mjs',
    'fixture.spec.mjs',
  ])('exempts %s from changed runtime contracts', (name) => {
    const path = `apps/web/src/lib/analytics/${name}`;
    expect(
      analyzeChangedRuntimeContracts([path], new Map([[path, 'run();']]))
    ).toEqual([]);
  });
});
