import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { CustomTabBar } from './CustomTabBar';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
  },
}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#000000',
      tabIconDefault: '#cccccc',
      selectedIconBackground: 'rgba(220, 38, 38, 0.08)',
      primary: '#ff0000',
      card: '#ffffff',
      primaryForeground: '#ffffff',
    },
    isDark: false,
  }),
}));

const mockUseKeyboard = jest.fn(() => ({
  dismissKeyboard: jest.fn(),
  isKeyboardVisible: false,
  keyboardHeight: 0,
  withKeyboardDismiss: <T extends (...args: never[]) => unknown>(handler: T) =>
    handler,
}));

jest.mock('@/hooks/use-keyboard', () => ({
  useKeyboard: () => mockUseKeyboard(),
}));

describe('CustomTabBar', () => {
  let mockProps: BottomTabBarProps;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseKeyboard.mockReturnValue({
      dismissKeyboard: jest.fn(),
      isKeyboardVisible: false,
      keyboardHeight: 0,
      withKeyboardDismiss: <T extends (...args: never[]) => unknown>(
        handler: T
      ) => handler,
    });

    mockProps = {
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
      state: {
        index: 0,
        routes: [
          { key: 'home-key', name: 'index', params: {} },
          { key: 'saved-key', name: 'saved', params: {} },
          { key: 'hidden-key', name: 'categories', params: {} },
        ],
        type: 'tab',
        routeNames: ['index', 'saved', 'categories'],
        history: [],
        key: 'state-key',
        stale: false,
        preloadedRouteKeys: [],
      },
      descriptors: {
        'home-key': {
          options: {
            title: 'Home',
            tabBarIcon: () => <React.Fragment />,
            tabBarLabel: () => <React.Fragment />,
          },
          navigation:
            {} as unknown as BottomTabBarProps['descriptors'][string]['navigation'],
          route:
            {} as unknown as BottomTabBarProps['descriptors'][string]['route'],
          render: () => <React.Fragment />,
        },
        'saved-key': {
          options: {
            title: 'Saved',
            tabBarIcon: () => <React.Fragment />,
            tabBarLabel: () => <React.Fragment />,
          },
          navigation:
            {} as unknown as BottomTabBarProps['descriptors'][string]['navigation'],
          route:
            {} as unknown as BottomTabBarProps['descriptors'][string]['route'],
          render: () => <React.Fragment />,
        },
        'hidden-key': {
          options: {
            href: null,
            title: 'Explore',
          } as unknown as BottomTabBarProps['descriptors'][string]['options'],
          navigation:
            {} as unknown as BottomTabBarProps['descriptors'][string]['navigation'],
          route:
            {} as unknown as BottomTabBarProps['descriptors'][string]['route'],
          render: () => <React.Fragment />,
        },
      },
      navigation: {
        emit: jest.fn().mockReturnValue({ defaultPrevented: false }),
        navigate: jest.fn(),
      } as unknown as BottomTabBarProps['navigation'],
    };
  });

  it('renders visible tab items and ignores hidden routes', () => {
    render(<CustomTabBar {...mockProps} />);

    expect(screen.getByRole('tab', { name: 'Home' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Saved' })).toBeOnTheScreen();
    expect(screen.queryByRole('tab', { name: 'Explore' })).toBeNull();
  });

  it('hides the floating tab bar while the cart tab owns the checkout CTA', () => {
    const cartProps: BottomTabBarProps = {
      ...mockProps,
      state: {
        ...mockProps.state,
        index: 2,
        routes: [
          mockProps.state.routes[0],
          mockProps.state.routes[1],
          { key: 'cart-key', name: 'cart', params: {} },
          mockProps.state.routes[2],
        ],
        routeNames: ['index', 'saved', 'cart', 'categories'],
      },
      descriptors: {
        ...mockProps.descriptors,
        'cart-key': {
          options: {
            title: 'Cart',
            tabBarIcon: () => <React.Fragment />,
            tabBarLabel: () => <React.Fragment />,
          },
          navigation:
            {} as unknown as BottomTabBarProps['descriptors'][string]['navigation'],
          route:
            {} as unknown as BottomTabBarProps['descriptors'][string]['route'],
          render: () => <React.Fragment />,
        },
      },
    };

    const { toJSON } = render(<CustomTabBar {...cartProps} />);

    expect(toJSON()).toBeNull();
  });

  it('hides the floating tab bar while the keyboard is visible', () => {
    mockUseKeyboard.mockReturnValue({
      dismissKeyboard: jest.fn(),
      isKeyboardVisible: true,
      keyboardHeight: 320,
      withKeyboardDismiss: <T extends (...args: never[]) => unknown>(
        handler: T
      ) => handler,
    });

    const { toJSON } = render(<CustomTabBar {...mockProps} />);

    expect(toJSON()).toBeNull();
  });

  it('navigates to selected tab when pressed', () => {
    render(<CustomTabBar {...mockProps} />);

    fireEvent.press(screen.getByRole('tab', { name: 'Saved' }));

    expect(mockProps.navigation.emit).toHaveBeenCalledWith({
      type: 'tabPress',
      target: 'saved-key',
      canPreventDefault: true,
    });
    expect(mockProps.navigation.navigate).toHaveBeenCalledWith('saved', {});
  });

  it('does not navigate when tab press is prevented', () => {
    jest
      .mocked(mockProps.navigation.emit)
      .mockReturnValue({ defaultPrevented: true } as never);

    render(<CustomTabBar {...mockProps} />);

    fireEvent(screen.getByRole('tab', { name: 'Saved' }), 'pressIn');
    fireEvent.press(screen.getByRole('tab', { name: 'Saved' }));

    expect(mockProps.navigation.emit).toHaveBeenCalledWith({
      type: 'tabPress',
      target: 'saved-key',
      canPreventDefault: true,
    });
    expect(mockProps.navigation.navigate).not.toHaveBeenCalled();
  });

  it('triggers haptics on index change when platform is not web', () => {
    const originalOS = Platform.OS;
    Platform.OS = 'ios';
    try {
      const { rerender } = render(<CustomTabBar {...mockProps} />);

      // Simulate change in state index
      (mockProps.state as unknown as { index: number }).index = 1;
      rerender(<CustomTabBar {...mockProps} />);

      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Light
      );
    } finally {
      Platform.OS = originalOS;
    }
  });
});
