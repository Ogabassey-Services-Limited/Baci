import { describe, expect, it } from '@jest/globals';
import {
  getHomeContentBottomPadding,
  TAB_BAR_BASE_HEIGHT,
} from './layout';

describe('getHomeContentBottomPadding', () => {
  it('returns chat widget clearance when the widget is enabled', () => {
    expect(getHomeContentBottomPadding(34, true)).toBe(216);
  });

  it('falls back to tab bar clearance when the widget is disabled', () => {
    expect(getHomeContentBottomPadding(34, false)).toBe(
      TAB_BAR_BASE_HEIGHT + 34
    );
  });
});
