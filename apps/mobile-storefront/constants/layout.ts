export const TAB_BAR_BASE_HEIGHT = 49;
export const CHAT_WIDGET_DEFAULT_BOTTOM_OFFSET = 140;
export const CHAT_WIDGET_FAB_SIZE = 60;
export const CONTENT_OVERLAY_GAP = 16;
export const HOME_LOAD_MORE_THRESHOLD_PX = 240;

export function getHomeContentBottomPadding(
  bottomInset: number,
  isChatWidgetEnabled: boolean
) {
  const tabBarHeight = TAB_BAR_BASE_HEIGHT + bottomInset;
  const chatWidgetClearance = isChatWidgetEnabled
    ? CHAT_WIDGET_DEFAULT_BOTTOM_OFFSET +
      CHAT_WIDGET_FAB_SIZE +
      CONTENT_OVERLAY_GAP
    : 0;

  return Math.max(tabBarHeight, chatWidgetClearance);
}
