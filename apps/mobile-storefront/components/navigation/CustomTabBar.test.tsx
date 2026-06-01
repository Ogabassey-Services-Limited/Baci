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

describe('CustomTabBar', () => {
  let mockProps: BottomTabBarProps;

  beforeEach(() => {
    jest.clearAllMocks();

    mockProps = {
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
      },
      descriptors: {
        'home-key': {
          options: {
            title: 'Home',
            tabBarIcon: () => null,
            tabBarLabel: () => null,
          },
          navigation: {} as any,
          route: {} as any,
          render: () => null,
        },
        'saved-key': {
          options: {
            title: 'Saved',
            tabBarIcon: () => null,
            tabBarLabel: () => null,
          },
          navigation: {} as any,
          route: {} as any,
          render: () => null,
        },
        'hidden-key': {
          options: {
            href: null,
            title: 'Explore',
          },
          navigation: {} as any,
          route: {} as any,
          render: () => null,
        },
      },
      navigation: {
        emit: jest.fn().mockReturnValue({ defaultPrevented: false }),
        navigate: jest.fn(),
      } as any,
    };
  });

  it('renders visible tab items and ignores hidden routes', () => {
    render(<CustomTabBar {...mockProps} />);

    expect(screen.getByTestId('custom-tab-item-index')).toBeOnTheScreen();
    expect(screen.getByTestId('custom-tab-item-saved')).toBeOnTheScreen();
    expect(screen.queryByTestId('custom-tab-item-categories')).toBeNull();
  });

  it('navigates to selected tab when pressed', () => {
    render(<CustomTabBar {...mockProps} />);

    fireEvent.press(screen.getByTestId('custom-tab-item-saved'));

    expect(mockProps.navigation.emit).toHaveBeenCalledWith({
      type: 'tabPress',
      target: 'saved-key',
      canPreventDefault: true,
    });
    expect(mockProps.navigation.navigate).toHaveBeenCalledWith('saved', {});
  });

  it('triggers haptics on index change when platform is not web', () => {
    Platform.OS = 'ios';
    const { rerender } = render(<CustomTabBar {...mockProps} />);

    // Simulate change in state index
    mockProps.state.index = 1;
    rerender(<CustomTabBar {...mockProps} />);

    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  });
});
