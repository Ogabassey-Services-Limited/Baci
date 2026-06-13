import '@testing-library/jest-dom/vitest';
import type React from 'react';
import type { ComponentType, ReactNode } from 'react';
import { vi } from 'vitest';
import { getShadows, LIGHT_COLORS } from '@/constants/theme';
import type { Order } from '@/hooks/useOrders';

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
      View: ({ children }: { children?: React.ReactNode }) =>
        React.createElement('div', null, children),
      createAnimatedComponent: (Component: ComponentType) => Component,
    },
    interpolate: (value: number) => value,
    useAnimatedScrollHandler: (handler: unknown) => handler,
    useAnimatedStyle: (callback: () => object) => callback(),
    useSharedValue: (initial: unknown) => ({ value: initial }),
    withTiming: (value: unknown) => value,
  };
});

vi.mock('@shopify/flash-list', async () => {
  const React = await import('react');

  return {
    FlashList: ({
      data = [],
      keyExtractor,
      ListEmptyComponent,
      ListFooterComponent,
      renderItem,
    }: {
      data?: unknown[];
      keyExtractor?: (item: unknown, index: number) => string | number;
      ListEmptyComponent?: React.ReactNode | React.ComponentType;
      ListFooterComponent?: React.ReactNode | React.ComponentType;
      renderItem?: (info: { item: unknown; index: number }) => React.ReactNode;
    }) =>
      React.createElement(
        'div',
        null,
        data.length > 0
          ? data.map((item, index) =>
              React.createElement(
                'div',
                { key: keyExtractor?.(item, index) ?? index },
                renderItem?.({ item, index })
              )
            )
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
          type: 'button',
        },
        children
      ),
    RefreshControl: () => null,
    ScrollView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    StyleSheet: {
      create: <T,>(styles: T) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      onChangeText,
      placeholder,
      value,
    }: {
      onChangeText?: (value: string) => void;
      placeholder?: string;
      value?: string;
    }) =>
      React.createElement('input', {
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
        placeholder,
        value: value ?? '',
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
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
