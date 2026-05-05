import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import type React from 'react';
import { Text, View } from 'react-native';
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

const mockTabsScreen = jest.fn(({ name }: MockTabsScreenProps) => (
  <MockText>{name}</MockText>
));
const mockTabs = jest.fn(
  ({
    children,
  }: {
    children?: React.ReactNode;
    screenOptions?: Record<string, unknown>;
  }) => (
    <MockView testID="tabs-root" accessibilityLabel="tabs root">
      {children}
    </MockView>
  )
);

jest.mock('expo-router', () => {
  const Tabs = (props: {
    children?: React.ReactNode;
    screenOptions?: Record<string, unknown>;
  }) => mockTabs(props);

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

function findScreenCallByName(name: string) {
  return mockTabsScreen.mock.calls.find(([props]) => props.name === name);
}

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

    const screenOptions = mockTabs.mock.calls[0]?.[0]?.screenOptions as
      | {
          tabBarStyle?: {
            height?: number;
            paddingBottom?: number;
          };
        }
      | undefined;

    expect(screenOptions?.tabBarStyle).toMatchObject({
      height: TAB_BAR_BASE_HEIGHT + mockSafeAreaInsets.bottom,
      paddingBottom: Math.max(mockSafeAreaInsets.bottom - 4, 8),
    });
  });

  it('explicitly keeps the cart tab header hidden', () => {
    render(<TabLayout />);

    const cartScreenCall = findScreenCallByName('cart');

    expect(cartScreenCall).toBeDefined();
    expect(cartScreenCall?.[0].options).toMatchObject({
      headerShown: false,
    });
  });
});
