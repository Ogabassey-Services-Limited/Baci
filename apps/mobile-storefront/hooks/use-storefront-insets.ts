import type { ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STOREFRONT_LAYOUT } from '@/constants/storefront-layout';

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
      (options.paddingBottom ??
        STOREFRONT_LAYOUT.insetDefaults.scrollPaddingBottom) +
      (options.includeBottomInset === false ? 0 : insets.bottom);

    return {
      paddingBottom,
      paddingTop:
        options.paddingTop ?? STOREFRONT_LAYOUT.insetDefaults.scrollPaddingTop,
    };
  };

  const getListContentStyle = (
    options: ListContentStyleOptions = {}
  ): ViewStyle => {
    const bottomInset =
      options.includeBottomInset === false ? 0 : insets.bottom;

    const contentStyle: ViewStyle = {
      gap: options.gap ?? STOREFRONT_LAYOUT.insetDefaults.listGap,
      padding: options.padding ?? STOREFRONT_LAYOUT.insetDefaults.listPadding,
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
        : (options.padding ?? STOREFRONT_LAYOUT.insetDefaults.listPadding);
    contentStyle.paddingBottom = paddingBottomBase + bottomInset;

    return contentStyle;
  };

  return {
    getListContentStyle,
    getScrollContentStyle,
    insets,
  };
}
