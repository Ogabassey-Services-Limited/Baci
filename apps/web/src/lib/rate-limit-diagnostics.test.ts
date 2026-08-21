import { afterEach, describe, expect, it } from 'vitest';
import {
  reportRateLimitDiagnostic,
  resetRateLimitDiagnosticHook,
  setRateLimitDiagnosticHook,
} from './rate-limit-diagnostics';

afterEach(() => {
  resetRateLimitDiagnosticHook();
});

describe('rate-limit diagnostics', () => {
  it('reports fixed-cardinality backend outcomes to the installed sink', () => {
    const diagnostics: unknown[] = [];
    setRateLimitDiagnosticHook((diagnostic) => diagnostics.push(diagnostic));

    reportRateLimitDiagnostic({
      backend: 'memory',
      reason: 'redis_unavailable',
    });

    expect(diagnostics).toEqual([
      { backend: 'memory', reason: 'redis_unavailable' },
    ]);
  });

  it('swallows sink failures', () => {
    setRateLimitDiagnosticHook(() => {
      throw new Error('diagnostic sink unavailable');
    });

    expect(() =>
      reportRateLimitDiagnostic({
        backend: 'redis',
        reason: 'redis_success',
      })
    ).not.toThrow();
  });
});
