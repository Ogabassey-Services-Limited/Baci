import { describe, expect, it } from 'vitest';
import { shouldRecordWorkerSuccess } from './worker-heartbeat-throttle';

describe('shouldRecordWorkerSuccess', () => {
  it('records the first success heartbeat', () => {
    expect(shouldRecordWorkerSuccess(null, 0, 10_000)).toBe(true);
  });

  it('records activity immediately', () => {
    expect(shouldRecordWorkerSuccess(10_000, 1, 10_001)).toBe(true);
  });

  it('suppresses idle writes below the heartbeat interval', () => {
    expect(shouldRecordWorkerSuccess(10_000, 0, 39_999)).toBe(false);
  });

  it('records an idle heartbeat at the interval boundary', () => {
    expect(shouldRecordWorkerSuccess(10_000, 0, 40_000)).toBe(true);
  });
});
