import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import { AdminFloatingTabBarItem } from './AdminFloatingTabBarItem';

vi.mock('react-native', () => ({
  StatusBar: () => null,
  Pressable: ({
    accessibilityLabel,
    accessibilityRole,
    accessibilityState,
    children,
    onPress,
    onPressIn,
    onPressOut,
    testID,
  }: {
    accessibilityLabel?: string;
    accessibilityRole?: string;
    accessibilityState?: { selected?: boolean };
    children?: ReactNode;
    onPress?: () => void;
    onPressIn?: () => void;
    onPressOut?: () => void;
    testID?: string;
  }) => (
    <button
      aria-label={accessibilityLabel}
      data-role={accessibilityRole}
      data-selected={String(Boolean(accessibilityState?.selected))}
      data-testid={testID}
      onClick={() => onPress?.()}
      onMouseDown={() => onPressIn?.()}
      onMouseUp={() => onPressOut?.()}
      type="button"
    >
      {children}
    </button>
  ),
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({
    children,
    style,
  }: {
    children?: ReactNode;
    numberOfLines?: number;
    style?: unknown;
  }) => <span data-style={JSON.stringify(style)}>{children}</span>,
  View: ({
    children,
    testID,
  }: {
    children?: ReactNode;
    style?: unknown;
    testID?: string;
  }) => <div data-testid={testID}>{children}</div>,
}));

describe('AdminFloatingTabBarItem', () => {
  it('renders the focused tab icon, label, and badge', () => {
    render(
      <AdminFloatingTabBarItem
        badge={3}
        colors={LIGHT_COLORS}
        isFocused
        label="Customers"
        onPress={vi.fn()}
        onPressIn={vi.fn()}
        onPressOut={vi.fn()}
        options={{
          tabBarIcon: ({ color, focused, size }) => (
            <span
              data-color={color}
              data-focused={String(focused)}
              data-testid="tab-icon"
              data-size={size}
            />
          ),
        }}
        routeName="customers"
      />
    );

    expect(screen.getByLabelText('Customers')).toHaveAttribute(
      'data-selected',
      'true'
    );
    expect(screen.getByTestId('tab-icon')).toHaveAttribute(
      'data-color',
      LIGHT_COLORS.primary
    );
    expect(screen.getByTestId('tab-icon')).toHaveAttribute('data-size', '24');
    expect(screen.getByText('Customers')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('fires press-in and press handlers separately', () => {
    const onPress = vi.fn();
    const onPressIn = vi.fn();
    const onPressOut = vi.fn();

    render(
      <AdminFloatingTabBarItem
        colors={LIGHT_COLORS}
        isFocused={false}
        label="Orders"
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        options={{}}
        routeName="orders"
      />
    );

    const tab = screen.getByLabelText('Orders');
    fireEvent.mouseDown(tab);
    fireEvent.mouseUp(tab);
    fireEvent.click(tab);

    expect(onPressIn).toHaveBeenCalledTimes(1);
    expect(onPressOut).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
