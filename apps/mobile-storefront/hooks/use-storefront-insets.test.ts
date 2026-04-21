import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { renderHook } from '@testing-library/react-native';

const mockUseSafeAreaInsets = jest.fn();

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockUseSafeAreaInsets(),
}));

import { useStorefrontInsets } from './use-storefront-insets';

describe('useStorefrontInsets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSafeAreaInsets.mockReturnValue({
      top: 24,
      bottom: 34,
      left: 0,
      right: 0,
    });
  });

  it('builds scroll and list padding presets from the safe-area insets', () => {
    const { result } = renderHook(() => useStorefrontInsets());

    expect(result.current.insets).toEqual({
      top: 24,
      bottom: 34,
      left: 0,
      right: 0,
    });
    expect(result.current.getScrollContentStyle()).toEqual({
      paddingTop: 20,
      paddingBottom: 94,
    });
    expect(result.current.getListContentStyle()).toEqual({
      padding: 16,
      gap: 12,
      paddingBottom: 50,
    });
  });

  it('allows list overrides when the shell already covers the edge', () => {
    const { result } = renderHook(() => useStorefrontInsets());

    expect(
      result.current.getListContentStyle({
        paddingTop: 16,
        paddingBottom: 24,
        paddingHorizontal: 20,
        gap: 8,
        includeBottomInset: false,
      })
    ).toEqual({
      padding: 16,
      paddingTop: 16,
      paddingBottom: 24,
      paddingHorizontal: 20,
      gap: 8,
    });
  });

  it('preserves default list padding and gap when only partial overrides are provided', () => {
    const { result } = renderHook(() => useStorefrontInsets());

    expect(
      result.current.getListContentStyle({
        paddingTop: 24,
      })
    ).toEqual({
      gap: 12,
      padding: 16,
      paddingTop: 24,
      paddingBottom: 50,
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
      paddingTop: 20,
      paddingBottom: 60,
    });
    expect(result.current.getListContentStyle()).toEqual({
      gap: 12,
      padding: 16,
      paddingBottom: 16,
    });
  });
});
