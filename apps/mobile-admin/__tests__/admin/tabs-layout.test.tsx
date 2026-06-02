import { render } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  failedOrders: [] as Array<{ id: string }>,
  screens: [] as Array<{
    name: string;
    options?: Record<string, unknown>;
  }>,
  tabsProps: null as null | Record<string, unknown>,
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    StyleSheet: {
      create: <T,>(styles: T) => styles,
    },
    View: ({
      children,
      style,
      testID,
    }: {
      children?: React.ReactNode;
      style?: unknown;
      testID?: string;
    }) =>
      React.createElement(
        'div',
        {
          'data-style': JSON.stringify(style),
          'data-testid': testID,
        },
        children
      ),
  };
});

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,

  default: () => null,
  __esModule: true,
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 59, right: 0, bottom: 34, left: 0 }),
}));

vi.mock('expo-router', async () => {
  const React = await import('react');

  const Tabs = ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
    [key: string]: unknown;
  }) => {
    mocks.tabsProps = props;
    return React.createElement('div', { 'data-testid': 'tabs-root' }, children);
  };

  Tabs.Screen = ({
    name,
    options,
  }: {
    name: string;
    options?: Record<string, unknown>;
  }) => {
    mocks.screens.push({ name, options });
    return null;
  };

  return { Tabs };
});

vi.mock('@/hooks/useFailedOrders', () => ({
  useFailedOrders: () => ({ data: mocks.failedOrders }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      border: '#e5e7eb',
      card: '#ffffff',
      goldLight: '#fef3c7',
      primary: '#2563eb',
      textSecondary: '#64748b',
    },
  }),
}));

import TabLayout from '@/app/(admin)/(tabs)/_layout';

describe('TabLayout', () => {
  beforeEach(() => {
    mocks.failedOrders = [];
    mocks.screens = [];
    mocks.tabsProps = null;
  });

  it('uses bottom safe-area inset without negative shell offsets', () => {
    const { getByTestId } = render(<TabLayout />);

    expect(getByTestId('tabs-root')).toBeTruthy();

    const screenOptions = mocks.tabsProps?.screenOptions as {
      tabBarStyle: {
        height: number;
        paddingBottom: number;
        paddingTop: number;
      };
      tabBarItemStyle: { height: number };
    };
    expect(screenOptions).toBeDefined();

    expect(screenOptions.tabBarStyle.height).toBe(92);
    expect(screenOptions.tabBarStyle.paddingBottom).toBe(34);
    expect(screenOptions.tabBarStyle.paddingTop).toBe(8);
    expect(screenOptions.tabBarItemStyle.height).toBe(50);

    const shellStyle =
      getByTestId('tab-shell').getAttribute('data-style') ?? '';
    expect(shellStyle).not.toContain('marginBottom');
  });

  it('places follow-up badges on Customers instead of Orders', () => {
    mocks.failedOrders = [{ id: 'dropoff-1' }, { id: 'dropoff-2' }];

    render(<TabLayout />);

    const ordersScreen = mocks.screens.find((screen) => screen.name === 'orders');
    const customersScreen = mocks.screens.find(
      (screen) => screen.name === 'customers'
    );

    expect(ordersScreen?.options?.tabBarBadge).toBeUndefined();
    expect(customersScreen?.options?.tabBarBadge).toBe(2);
  });
});
