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
    options?: ListContentStyleOptions
  ): ViewStyle => {
    if (!options) {
      return {
        gap: DEFAULT_LIST_GAP,
        padding: DEFAULT_LIST_PADDING,
      };
    }

    const contentStyle: ViewStyle = {};

    if (typeof options.padding === 'number') {
      contentStyle.padding = options.padding;
    }

    if (typeof options.paddingTop === 'number') {
      contentStyle.paddingTop = options.paddingTop;
    }

    if (typeof options.paddingHorizontal === 'number') {
      contentStyle.paddingHorizontal = options.paddingHorizontal;
    }

    if (typeof options.paddingBottom === 'number') {
      contentStyle.paddingBottom =
        options.paddingBottom +
        (options.includeBottomInset ? insets.bottom : 0);
    }

    if (typeof options.gap === 'number') {
      contentStyle.gap = options.gap;
    }

    return contentStyle;
  };

  return {
    getListContentStyle,
    getScrollContentStyle,
    insets,
  };
}
