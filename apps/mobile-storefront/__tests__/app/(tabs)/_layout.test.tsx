import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import type React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import TabLayout from '@/app/(tabs)/_layout';
import { BRAND } from '@/constants/Colors';
import { TAB_BAR_BASE_HEIGHT } from '@/constants/layout';

const MockText = Text;
const MockView = View;
const mockThemeColors = {
  background: '#101010',
  border: '#333333',
  card: '#202020',
  mutedForeground: '#999999',
  selectedIconBackground: '#303030',
  tabIconDefault: '#888888',
  tabIconSelected: '#ffffff',
  text: '#f5f5f5',
};
const mockSafeAreaInsets = {
  top: 59,
  right: 0,
  bottom: 34,
  left: 0,
};
type MockTabBarIconOptions = {
  focused: boolean;
  color: string;
  size: number;
};
type MockTabBarLabelOptions = {
  focused: boolean;
  color: string;
  children: string;
  position: 'below-icon' | 'beside-icon';
};
type MockTabsScreenProps = {
  name: string;
  options?: {
    headerShown?: boolean;
    tabBarIcon?: (options: MockTabBarIconOptions) => React.ReactNode;
    tabBarLabel?: (options: MockTabBarLabelOptions) => React.ReactNode;
  };
};
type MockTabsProps = {
  children?: React.ReactNode;
  screenOptions?: {
    tabBarStyle?: ViewStyle;
  };
};

const mockTabsScreen = jest.fn(({ name, options }: MockTabsScreenProps) => (
  <MockView>
    <MockText
      accessibilityLabel={`${name} screen header ${
        options?.headerShown === false ? 'hidden' : 'shown'
      }`}
    >
      {name}
    </MockText>
    {options?.tabBarIcon?.({ focused: true, color: '#000000', size: 22 })}
    {options?.tabBarLabel?.({
      focused: true,
      color: '#000000',
      children: name,
      position: 'below-icon',
    })}
  </MockView>
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

jest.mock('@expo/vector-icons', () => {
  const { Text: MockIconText } =
    jest.requireActual<typeof import('react-native')>('react-native');

  return {
    Ionicons: ({
      color,
      name,
      style,
    }: {
      color: string;
      name: string;
      style?: StyleProp<TextStyle>;
    }) => (
      <MockIconText testID={`tab-icon-${name}`} style={[style, { color }]}>
        {name}
      </MockIconText>
    ),
  };
});

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

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: mockThemeColors,
    isDark: true,
    shadows: {},
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

  it('uses theme colors for the tab chrome while preserving badge contrast', () => {
    render(<TabLayout />);

    const tabsRootStyle = StyleSheet.flatten(
      screen.getByLabelText('tabs root').props.style
    );
    const cartBadgeText = screen.getByText('2');
    const cartBadgeTextStyle = StyleSheet.flatten(cartBadgeText.props.style);
    const cartBadgeStyle = StyleSheet.flatten(
      cartBadgeText.parent?.parent?.props.style
    );

    expect(tabsRootStyle).toMatchObject({
      backgroundColor: mockThemeColors.card,
      borderTopColor: mockThemeColors.border,
    });
    expect(cartBadgeStyle).toMatchObject({
      backgroundColor: BRAND.primary,
      borderColor: mockThemeColors.card,
    });
    expect(cartBadgeTextStyle).toMatchObject({
      color: BRAND.onPrimary,
    });
  });
});
