import type { ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STOREFRONT_INSET_DEFAULTS } from '@/constants/storefront-inset-defaults';

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

export function useStorefrontInsets() {
  const insets = useSafeAreaInsets();

  const getScrollContentStyle = (
    options: ScrollContentStyleOptions = {}
  ): ViewStyle => {
    const paddingBottom =
      (options.paddingBottom ?? STOREFRONT_INSET_DEFAULTS.scrollPaddingBottom) +
      (options.includeBottomInset === false ? 0 : insets.bottom);

    return {
      paddingBottom,
      paddingTop:
        options.paddingTop ?? STOREFRONT_INSET_DEFAULTS.scrollPaddingTop,
    };
  };

  const getListContentStyle = (
    options: ListContentStyleOptions = {}
  ): ViewStyle => {
    const bottomInset =
      options.includeBottomInset === false ? 0 : insets.bottom;

    const contentStyle: ViewStyle = {
      gap: options.gap ?? STOREFRONT_INSET_DEFAULTS.listGap,
      padding: options.padding ?? STOREFRONT_INSET_DEFAULTS.listPadding,
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
        : (options.padding ?? STOREFRONT_INSET_DEFAULTS.listPadding);
    contentStyle.paddingBottom = paddingBottomBase + bottomInset;

    return contentStyle;
  };

  return {
    getListContentStyle,
    getScrollContentStyle,
    insets,
  };
}
