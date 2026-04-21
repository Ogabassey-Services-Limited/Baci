import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { renderHook } from '@testing-library/react-native';
import { SPACING } from '@/constants/Colors';
import { STOREFRONT_INSET_DEFAULTS } from '@/constants/storefront-inset-defaults';

const mockUseSafeAreaInsets = jest.fn();
const DEFAULT_INSETS = {
  top: 24,
  bottom: 34,
  left: 0,
  right: 0,
} as const;

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockUseSafeAreaInsets(),
}));

import { useStorefrontInsets } from './use-storefront-insets';

describe('useStorefrontInsets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSafeAreaInsets.mockReturnValue(DEFAULT_INSETS);
  });

  it('builds scroll and list padding presets from the safe-area insets', () => {
    const { result } = renderHook(() => useStorefrontInsets());

    expect(result.current.insets).toEqual({
      top: DEFAULT_INSETS.top,
      bottom: DEFAULT_INSETS.bottom,
      left: 0,
      right: 0,
    });
    expect(result.current.getScrollContentStyle()).toEqual({
      paddingTop: STOREFRONT_INSET_DEFAULTS.scrollPaddingTop,
      paddingBottom:
        STOREFRONT_INSET_DEFAULTS.scrollPaddingBottom + DEFAULT_INSETS.bottom,
    });
    expect(result.current.getListContentStyle()).toEqual({
      padding: STOREFRONT_INSET_DEFAULTS.listPadding,
      gap: STOREFRONT_INSET_DEFAULTS.listGap,
      paddingBottom:
        STOREFRONT_INSET_DEFAULTS.listPadding + DEFAULT_INSETS.bottom,
    });
  });

  it('allows list overrides when the shell already covers the edge', () => {
    const { result } = renderHook(() => useStorefrontInsets());

    expect(
      result.current.getListContentStyle({
        paddingTop: SPACING.md,
        paddingBottom: SPACING.lg,
        paddingHorizontal: 20,
        gap: SPACING.sm,
        includeBottomInset: false,
      })
    ).toEqual({
      padding: STOREFRONT_INSET_DEFAULTS.listPadding,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.lg,
      paddingHorizontal: 20,
      gap: SPACING.sm,
    });
  });

  it('preserves default list padding and gap when only partial overrides are provided', () => {
    const { result } = renderHook(() => useStorefrontInsets());

    expect(
      result.current.getListContentStyle({
        paddingTop: SPACING.lg,
      })
    ).toEqual({
      gap: STOREFRONT_INSET_DEFAULTS.listGap,
      padding: STOREFRONT_INSET_DEFAULTS.listPadding,
      paddingTop: SPACING.lg,
      paddingBottom:
        STOREFRONT_INSET_DEFAULTS.listPadding + DEFAULT_INSETS.bottom,
    });
  });

  it('supports zero safe-area insets without adding extra list padding', () => {
    mockUseSafeAreaInsets.mockReturnValue({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    });

    const { result } = renderHook(() => useStorefrontInsets());

    expect(result.current.getScrollContentStyle()).toEqual({
      paddingTop: STOREFRONT_INSET_DEFAULTS.scrollPaddingTop,
      paddingBottom: STOREFRONT_INSET_DEFAULTS.scrollPaddingBottom,
    });
    expect(result.current.getListContentStyle()).toEqual({
      gap: STOREFRONT_INSET_DEFAULTS.listGap,
      padding: STOREFRONT_INSET_DEFAULTS.listPadding,
      paddingBottom: STOREFRONT_INSET_DEFAULTS.listPadding,
    });
  });
});
