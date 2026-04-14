import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import type React from 'react';
import { Text, View } from 'react-native';
import TabLayout from './_layout';

const MockText = Text;
const MockView = View;
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

const mockPush = jest.fn();

jest.mock('expo-router', () => {
  const Tabs = (props: {
    children?: React.ReactNode;
    screenOptions?: Record<string, unknown>;
  }) => mockTabs(props);

  Tabs.Screen = ({ name }: { name: string }) => <MockText>{name}</MockText>;

  return {
    Tabs,
    router: {
      push: (...args: unknown[]) => mockPush(...args),
    },
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    top: 59,
    right: 0,
    bottom: 34,
    left: 0,
  }),
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
    const { toJSON } = render(<TabLayout />);

    expect(toJSON()).toMatchObject({
      props: {
        testID: 'tabs-root',
      },
    });
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
      height: 83,
      paddingBottom: 30,
    });
  });
});
