import { render } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
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

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
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

  Tabs.Screen = () => null;

  return { Tabs };
});

vi.mock('@/hooks/useFailedOrders', () => ({
  useFailedOrders: () => ({ data: [] }),
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

import TabLayout from './_layout';

describe('TabLayout', () => {
  beforeEach(() => {
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
});
