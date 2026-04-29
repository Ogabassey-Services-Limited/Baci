import type { ViewStyle } from 'react-native';

/**
 * UTILITY_TYPE_TAB_PRESSED_STYLE is applied while utility type tabs are pressed.
 * The light opacity reduction gives native-feeling feedback without obscuring
 * selected tab colors, and `as const` keeps the shared token immutable.
 */
export const UTILITY_TYPE_TAB_PRESSED_STYLE = {
  opacity: 0.88,
} as const satisfies ViewStyle;
