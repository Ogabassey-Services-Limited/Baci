import { describe, expect, it } from '@jest/globals';
import {
  CHAT_WIDGET_DEFAULT_BOTTOM_OFFSET,
  CONTENT_OVERLAY_GAP,
  getChatWidgetBottomOffset,
  getHomeContentBottomPadding,
  TAB_BAR_BASE_HEIGHT,
} from './layout';

describe('getHomeContentBottomPadding', () => {
  it('returns chat widget clearance when the widget is enabled', () => {
    expect(getHomeContentBottomPadding(34, true)).toBe(175);
  });

  it('falls back to tab bar clearance when the widget is disabled', () => {
    expect(getHomeContentBottomPadding(34, false)).toBe(
      TAB_BAR_BASE_HEIGHT + 34
    );
  });
});

describe('getChatWidgetBottomOffset', () => {
  it('adds the bottom inset to the base chat widget offset', () => {
    expect(
      getChatWidgetBottomOffset(CHAT_WIDGET_DEFAULT_BOTTOM_OFFSET, 34)
    ).toBe(TAB_BAR_BASE_HEIGHT + CONTENT_OVERLAY_GAP + 34);
  });

  it('ignores negative bottom insets', () => {
    expect(
      getChatWidgetBottomOffset(CHAT_WIDGET_DEFAULT_BOTTOM_OFFSET, -10)
    ).toBe(CHAT_WIDGET_DEFAULT_BOTTOM_OFFSET);
  });
});
