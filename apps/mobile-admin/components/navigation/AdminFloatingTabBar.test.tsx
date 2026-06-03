import '@testing-library/jest-dom/vitest';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminFloatingTabBar } from './AdminFloatingTabBar';

const navigationMocks = vi.hoisted(() => ({
  useWarmAdminTabScreens: vi.fn(),
}));

vi.mock('./useWarmAdminTabScreens', () => ({
  useWarmAdminTabScreens: navigationMocks.useWarmAdminTabScreens,
}));

vi.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: {
    Light: 'light',
  },
  impactAsync: vi.fn(),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      gold: '#D4A03D',
      goldLight: 'rgba(212, 160, 61, 0.12)',
      notification: '#DC2626',
      primary: '#3B82F6',
      primaryLight: 'rgba(59, 130, 246, 0.1)',
      textOnNotification: '#FFFFFF',
      textSecondary: '#64748B',
    },
    isDark: false,
  }),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 34, left: 0 }),
}));

vi.mock('react-native-reanimated', () => {
  return {
    Easing: {
      bezier: () => 'bezier-easing',
    },
    default: {
      View: ({
        children,
        style,
        testID,
      }: {
        children?: ReactNode;
        pointerEvents?: string;
        style?: unknown;
        testID?: string;
      }) => (
        <div data-style={JSON.stringify(style)} data-testid={testID}>
          {children}
        </div>
      ),
    },
    cancelAnimation: vi.fn(),
    runOnUI: (worklet: (...args: unknown[]) => void) => worklet,
    useAnimatedStyle: (callback: () => object) => callback(),
    useSharedValue: (value: number) => ({ value }),
    withSpring: (value: number) => ({ type: 'spring', value }),
    withTiming: (value: number) => ({ type: 'timing', value }),
  };
});

vi.mock('react-native', () => {
  return {
    Platform: {
      OS: 'web',
    },
    Pressable: ({
      accessibilityLabel,
      children,
      onPress,
      onPressIn,
      testID,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      accessibilityState?: { selected?: boolean };
      children?: ReactNode;
      hitSlop?: unknown;
      onPress?: () => void;
      onPressIn?: () => void;
      style?: unknown;
      testID?: string;
    }) => (
      <button
        aria-label={accessibilityLabel}
        data-testid={testID}
        onClick={() => onPress?.()}
        onMouseDown={() => onPressIn?.()}
        type="button"
      >
        {children}
      </button>
    ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: ReactNode; style?: unknown }) => (
      <span>{children}</span>
    ),
    useWindowDimensions: () => ({ height: 844, width: 390 }),
    View: ({
      children,
      testID,
    }: {
      children?: ReactNode;
      pointerEvents?: string;
      style?: unknown;
      testID?: string;
    }) => <div data-testid={testID}>{children}</div>,
  };
});

function createProps(): BottomTabBarProps {
  const routes = [
    { key: 'index-key', name: 'index', params: {} },
    { key: 'orders-key', name: 'orders', params: { status: 'open' } },
    { key: 'products-key', name: 'products', params: {} },
    { key: 'customers-key', name: 'customers', params: {} },
    { key: 'menu-key', name: 'menu', params: {} },
    { key: 'inventory-key', name: 'inventory', params: {} },
    { key: 'settings-key', name: 'settings', params: {} },
  ];

  return {
    descriptors: {
      'index-key': {
        options: {
          tabBarIcon: () => <span data-testid="home-icon" />,
          title: 'Home',
        },
      },
      'inventory-key': {
        options: { href: null, title: 'Inventory' },
      },
      'customers-key': {
        options: {
          tabBarIcon: () => <span data-testid="customers-icon" />,
          title: 'Customers',
        },
      },
      'menu-key': {
        options: {
          tabBarIcon: () => <span data-testid="menu-icon" />,
          title: 'Menu',
        },
      },
      'orders-key': {
        options: {
          tabBarBadge: 2,
          tabBarIcon: () => <span data-testid="orders-icon" />,
          title: 'Orders',
        },
      },
      'products-key': {
        options: {
          tabBarIcon: () => <span data-testid="products-icon" />,
          title: 'Products',
        },
      },
      'settings-key': {
        options: {},
      },
    },
    insets: { bottom: 34, left: 0, right: 0, top: 0 },
    navigation: {
      dispatch: vi.fn(),
      emit: vi.fn(() => ({ defaultPrevented: false })),
    },
    state: {
      history: [],
      index: 0,
      key: 'admin-tabs-key',
      routeNames: routes.map((route) => route.name),
      routes,
      type: 'tab',
    },
  } as unknown as BottomTabBarProps;
}

describe('AdminFloatingTabBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders visible tabs and hides href-null routes', () => {
    render(<AdminFloatingTabBar {...createProps()} />);

    expect(screen.getByLabelText('Home')).toBeTruthy();
    expect(screen.getByLabelText('Orders')).toBeTruthy();
    expect(screen.getByLabelText('Products')).toBeTruthy();
    expect(screen.getByLabelText('Customers')).toBeTruthy();
    expect(screen.getByLabelText('Menu')).toBeTruthy();
    expect(screen.queryByLabelText('Inventory')).toBeNull();
    expect(screen.queryByLabelText('settings')).toBeNull();
    expect(screen.getByText('2')).toBeTruthy();
    expect(navigationMocks.useWarmAdminTabScreens).toHaveBeenCalledWith(
      expect.objectContaining({
        activeRouteName: 'index',
        routes: expect.arrayContaining([
          expect.objectContaining({ name: 'orders' }),
        ]),
      })
    );
  });

  it('jumps to the pressed tab immediately on press-in', () => {
    const props = createProps();
    globalThis.requestAnimationFrame = vi.fn();

    render(<AdminFloatingTabBar {...props} />);

    const ordersTab = screen.getByLabelText('Orders');
    fireEvent.mouseDown(ordersTab);
    fireEvent.click(ordersTab);

    expect(props.navigation.dispatch).toHaveBeenCalledWith({
      payload: { name: 'orders', params: { status: 'open' } },
      target: 'admin-tabs-key',
      type: 'JUMP_TO',
    });
    expect(props.navigation.dispatch).toHaveBeenCalledTimes(1);
    expect(globalThis.requestAnimationFrame).not.toHaveBeenCalled();
  });
});
