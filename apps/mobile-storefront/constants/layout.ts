export const TAB_BAR_BASE_HEIGHT = 49;
export const CHAT_WIDGET_FAB_SIZE = 60;
export const CONTENT_OVERLAY_GAP = 16;
/**
 * Base bottom spacing, in density-independent pixels, between the draggable
 * chat FAB and the bottom screen edge before safe-area insets are added.
 * This keeps the widget visually clear of the fixed tab bar on devices
 * without a home indicator; callers should add bottom inset separately.
 */
export const CHAT_WIDGET_DEFAULT_BOTTOM_OFFSET =
  TAB_BAR_BASE_HEIGHT + CONTENT_OVERLAY_GAP;
export const HOME_LOAD_MORE_THRESHOLD_PX = 240;

export function getChatWidgetBottomOffset(
  baseBottomOffset: number,
  bottomInset: number
) {
  return baseBottomOffset + Math.max(bottomInset, 0);
}

export function getHomeContentBottomPadding(
  bottomInset: number,
  isChatWidgetEnabled: boolean
) {
  const tabBarHeight = TAB_BAR_BASE_HEIGHT + bottomInset;
  const chatWidgetClearance = isChatWidgetEnabled
    ? getChatWidgetBottomOffset(
        CHAT_WIDGET_DEFAULT_BOTTOM_OFFSET,
        bottomInset
      ) +
      CHAT_WIDGET_FAB_SIZE +
      CONTENT_OVERLAY_GAP
    : 0;

  return Math.max(tabBarHeight, chatWidgetClearance);
}
