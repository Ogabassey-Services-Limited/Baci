import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import type React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import TabLayout from '@/app/(tabs)/_layout';

import { TAB_BAR_BASE_HEIGHT } from '@/constants/layout';

const MockText = Text;
const MockView = View;
const mockSafeAreaInsets = {
  top: 59,
  right: 0,
  bottom: 34,
  left: 0,
};
type MockTabsScreenProps = {
  name: string;
  options?: Record<string, unknown>;
};
type MockTabsProps = {
  children?: React.ReactNode;
  screenOptions?: {
    tabBarStyle?: ViewStyle;
  };
};

const mockTabsScreen = jest.fn(({ name, options }: MockTabsScreenProps) => (
  <MockText
    accessibilityLabel={`${name} screen header ${
      options?.headerShown === false ? 'hidden' : 'shown'
    }`}
  >
    {name}
  </MockText>
));
const mockTabs = jest.fn(({ children, screenOptions }: MockTabsProps) => (
  <MockView
    testID="tabs-root"
    accessibilityLabel="tabs root"
    style={screenOptions?.tabBarStyle}
  >
    {children}
  </MockView>
));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#FFFFFF',
      mutedForeground: '#9CA3AF',
      card: '#0F0F0F',
      border: 'rgba(255, 255, 255, 0.08)',
      background: '#000000',
      primaryForeground: '#FFFFFF',
      primary: '#DC2626',
      primaryLowOpacity: 'rgba(255, 0, 0, 0.1)',
      icon: '#9CA3AF',
          },
  }),
}));

jest.mock('expo-router', () => {
  const Tabs = (props: MockTabsProps) => mockTabs(props);

  Tabs.Screen = (props: MockTabsScreenProps) => mockTabsScreen(props);

  return {
    Tabs,
    router: {
      push: jest.fn(),
    },
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockSafeAreaInsets,
}));

jest.mock('zustand/react/shallow', () => ({
  useShallow: <T,>(selector: T) => selector,
}));

jest.mock('@/stores/cart-store', () => ({
  useCartStore: (selector: (state: { itemCount: () => number }) => unknown) =>
    selector({ itemCount: () => 2 }),
}));

jest.mock('@/stores/saved-store', () => ({
  useSavedStore: (
    selector: (state: { items: unknown[] }) => unknown
  ) => selector({ items: [{ id: 'saved-1' }] }),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (
    selector: (state: {
      isInitialized: boolean;
      user: { id: string } | null;
    }) => unknown
  ) =>
    selector({
      isInitialized: true,
      user: { id: 'user-1' },
    }),
}));

describe('TabLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the tab navigator without wrapping it in a notch-shifting shell', () => {
    render(<TabLayout />);

    expect(screen.getByLabelText('tabs root')).toBeOnTheScreen();
  });

  it('keeps bottom tab sizing based on safe-area insets without offsetting the top edge', () => {
    render(<TabLayout />);

    const tabsRootStyle = StyleSheet.flatten(
      screen.getByLabelText('tabs root').props.style
    );

    expect(tabsRootStyle).toMatchObject({
      height: TAB_BAR_BASE_HEIGHT + mockSafeAreaInsets.bottom,
      paddingBottom: Math.max(mockSafeAreaInsets.bottom - 4, 8),
    });
  });

  it('explicitly keeps the cart tab header hidden', () => {
    render(<TabLayout />);

    expect(screen.getByLabelText('cart screen header hidden')).toBeOnTheScreen();
  });
});
