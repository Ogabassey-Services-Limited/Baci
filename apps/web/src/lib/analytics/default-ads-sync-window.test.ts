import { describe, expect, it } from 'vitest';
import { buildDefaultAdsSyncWindow } from './default-ads-sync-window';

describe('buildDefaultAdsSyncWindow', () => {
  it('preserves local calendar dates near a positive-offset midnight boundary', () => {
    expect(buildDefaultAdsSyncWindow(new Date(2026, 7, 21, 0, 30))).toEqual({
      endDate: '2026-08-21',
      startDate: '2026-07-22',
    });
  });
});
