import '@testing-library/jest-dom/vitest';
import type React from 'react';
import type { ComponentType, ReactNode } from 'react';
import { vi } from 'vitest';
import { getShadows, LIGHT_COLORS } from '@/constants/theme';
import type { Order } from '@/hooks/useOrders';
import {
  type MockNativeStyle,
  resolveStyle,
  testIdProps,
} from './orders-screen-style-test-utils';

function renderReactNode(node: ReactNode | ComponentType | null | undefined) {
  if (!node) return null;
  if (typeof node === 'function') {
    const Component = node as ComponentType;
    return <Component />;
  }
  return node;
}

vi.mock('@react-native-vector-icons/ionicons', async () => {
  const React = await import('react');
  const Icon = ({ name }: { color?: string; name: string; size?: number }) =>
    React.createElement('span', { 'data-icon': name }, name);

  return {
    Ionicons: Icon,
    default: Icon,
    __esModule: true,
  };
});

vi.mock('react-native-reanimated', async () => {
  const React = await import('react');

  return {
    default: {
      View: ({
        children,
        style,
        testID,
      }: {
        children?: React.ReactNode;
        style?: MockNativeStyle;
        testID?: string;
      }) =>
        React.createElement(
          'div',
          { style: resolveStyle(style), ...testIdProps(testID) },
          children
        ),
      createAnimatedComponent: (Component: ComponentType) => Component,
    },
    interpolate: (value: number) => value,
    useAnimatedScrollHandler: (handler: unknown) => handler,
    useAnimatedStyle: (callback: () => object) => callback(),
    // Mirror the Reanimated SharedValue surface: get()/set() accessors plus the
    // legacy `value` property, so source using either API works under test.
    useSharedValue: (initial: unknown) => {
      let current = initial;
      return {
        get: () => current,
        set: (next: unknown) => {
          current = next;
        },
        get value() {
          return current;
        },
        set value(next: unknown) {
          current = next;
        },
      };
    },
    withTiming: (value: unknown) => value,
  };
});

vi.mock('@shopify/flash-list', async () => {
  const React = await import('react');

  return {
    FlashList: ({
      contentContainerStyle,
      data = [],
      ItemSeparatorComponent,
      keyExtractor,
      ListEmptyComponent,
      ListFooterComponent,
      onScroll,
      renderItem,
    }: {
      contentContainerStyle?: MockNativeStyle;
      data?: unknown[];
      ItemSeparatorComponent?: React.ReactNode | React.ComponentType;
      keyExtractor?: (item: unknown, index: number) => string | number;
      ListEmptyComponent?: React.ReactNode | React.ComponentType;
      ListFooterComponent?: React.ReactNode | React.ComponentType;
      onScroll?: (event: {
        nativeEvent: { contentOffset: { y: number } };
      }) => void;
      renderItem?: (info: { item: unknown; index: number }) => React.ReactNode;
    }) =>
      React.createElement(
        'div',
        {
          'data-testid': 'orders-list-content',
          onScroll: (event: React.UIEvent<HTMLDivElement>) => {
            onScroll?.({
              nativeEvent: {
                contentOffset: {
                  y: Number(event.currentTarget.scrollTop) || 0,
                },
              },
            });
          },
          style: resolveStyle(contentContainerStyle),
        },
        data.length > 0
          ? data.flatMap((item, index) => {
              const row = React.createElement(
                'div',
                { key: `row-${keyExtractor?.(item, index) ?? index}` },
                renderItem?.({ item, index })
              );
              if (index === data.length - 1) return [row];
              return [
                row,
                React.createElement(
                  React.Fragment,
                  { key: `separator-${index}` },
                  renderReactNode(ItemSeparatorComponent)
                ),
              ];
            })
          : renderReactNode(ListEmptyComponent),
        renderReactNode(ListFooterComponent)
      ),
  };
});

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    StatusBar: () => null,
    useColorScheme: () => 'light',
    ActivityIndicator: ({
      accessibilityLabel,
    }: {
      accessibilityLabel?: string;
    }) =>
      React.createElement(
        'span',
        { role: 'status', 'aria-label': accessibilityLabel },
        'loading'
      ),
    Alert: { alert: vi.fn() },
    Pressable: ({
      accessibilityLabel,
      accessibilityRole,
      accessibilityState,
      children,
      disabled,
      onPress,
      style,
      testID,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      accessibilityState?: {
        checked?: boolean;
        disabled?: boolean;
        selected?: boolean;
      };
      children?: React.ReactNode;
      disabled?: boolean;
      onPress?: (event: {
        nativeEvent: { pageX: number; pageY: number; target: number };
        stopPropagation: () => void;
        target: number;
      }) => void;
      style?: MockNativeStyle;
      testID?: string;
    }) =>
      React.createElement(
        'button',
        {
          'aria-checked': accessibilityState?.checked,
          'aria-disabled': accessibilityState?.disabled,
          'aria-label': accessibilityLabel,
          'aria-selected': accessibilityState?.selected,
          disabled,
          onClick: () =>
            onPress?.({
              nativeEvent: { pageX: 220, pageY: 180, target: 1 },
              stopPropagation: () => undefined,
              target: 1,
            }),
          role: accessibilityRole,
          style: resolveStyle(style),
          ...testIdProps(testID),
          type: 'button',
        },
        children
      ),
    RefreshControl: () => null,
    ScrollView: ({
      children,
      style,
      testID,
    }: {
      children?: React.ReactNode;
      style?: MockNativeStyle;
      testID?: string;
    }) =>
      React.createElement(
        'div',
        { style: resolveStyle(style), ...testIdProps(testID) },
        children
      ),
    StyleSheet: {
      create: <T,>(styles: T) => styles,
    },
    Text: ({
      children,
      style,
      testID,
    }: {
      children?: React.ReactNode;
      style?: MockNativeStyle;
      testID?: string;
    }) =>
      React.createElement(
        'span',
        { style: resolveStyle(style), ...testIdProps(testID) },
        children
      ),
    TextInput: ({
      onChangeText,
      placeholder,
      style,
      testID,
      value,
    }: {
      onChangeText?: (value: string) => void;
      placeholder?: string;
      style?: MockNativeStyle;
      testID?: string;
      value?: string;
    }) =>
      React.createElement('input', {
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
        placeholder,
        style: resolveStyle(style),
        ...testIdProps(testID),
        value: value ?? '',
      }),
    View: ({
      children,
      style,
      testID,
    }: {
      children?: React.ReactNode;
      style?: MockNativeStyle;
      testID?: string;
    }) =>
      React.createElement(
        'div',
        { style: resolveStyle(style), ...testIdProps(testID) },
        children
      ),
  };
});

vi.mock('@/components/ui/haptics', () => ({
  triggerLightHaptic: vi.fn(),
}));

export const mockColors = LIGHT_COLORS;

export const mockShadows = getShadows(false);

export const mockOrder = {
  id: 'order-1',
  created_at: '2026-06-12T12:00:00Z',
  shipping_status: 'pending',
  payment_status: 'paid',
  total: 10_000,
  currency: 'NGN',
  order_number: 'ORD-1001',
  customer_name: 'Ada Doe',
  item_count: 2,
  source: 'web',
} as Order;
