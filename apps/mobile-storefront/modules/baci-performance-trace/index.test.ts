import BaciPerformanceTrace from './index';
import BaciPerformanceTraceModule from './src/BaciPerformanceTraceModule';

describe('baci-performance-trace public module', () => {
  it('re-exports the optional native module contract', () => {
    expect(BaciPerformanceTrace).toBe(BaciPerformanceTraceModule);
  });

  it('exposes the unsupported-platform fallback when native tracing is absent', () => {
    expect(BaciPerformanceTrace).toBeNull();
  });
});
