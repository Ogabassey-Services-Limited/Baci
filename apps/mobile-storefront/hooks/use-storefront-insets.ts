import type { ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ScrollContentStyleOptions {
  includeBottomInset?: boolean;
  paddingBottom?: number;
  paddingTop?: number;
}

interface ListContentStyleOptions {
  gap?: number;
  includeBottomInset?: boolean;
  padding?: number;
  paddingBottom?: number;
  paddingHorizontal?: number;
  paddingTop?: number;
}

const DEFAULT_SCROLL_PADDING_TOP = 20;
const DEFAULT_SCROLL_PADDING_BOTTOM = 60;
const DEFAULT_LIST_PADDING = 16;
const DEFAULT_LIST_GAP = 12;

export function useStorefrontInsets() {
  const insets = useSafeAreaInsets();

  const getScrollContentStyle = (
    options: ScrollContentStyleOptions = {}
  ): ViewStyle => {
    const paddingBottom =
      (options.paddingBottom ?? DEFAULT_SCROLL_PADDING_BOTTOM) +
      (options.includeBottomInset === false ? 0 : insets.bottom);

    return {
      paddingBottom,
      paddingTop: options.paddingTop ?? DEFAULT_SCROLL_PADDING_TOP,
    };
  };

  const getListContentStyle = (
    options: ListContentStyleOptions = {}
  ): ViewStyle => {
    const bottomInset =
      options.includeBottomInset === false ? 0 : insets.bottom;

    const contentStyle: ViewStyle = {
      gap: options.gap ?? DEFAULT_LIST_GAP,
      padding: options.padding ?? DEFAULT_LIST_PADDING,
    };

    if (typeof options.paddingTop === 'number') {
      contentStyle.paddingTop = options.paddingTop;
    }

    if (typeof options.paddingHorizontal === 'number') {
      contentStyle.paddingHorizontal = options.paddingHorizontal;
    }

    const paddingBottomBase =
      typeof options.paddingBottom === 'number'
        ? options.paddingBottom
        : (options.padding ?? DEFAULT_LIST_PADDING);
    contentStyle.paddingBottom = paddingBottomBase + bottomInset;

    return contentStyle;
  };

  return {
    getListContentStyle,
    getScrollContentStyle,
    insets,
  };
}
