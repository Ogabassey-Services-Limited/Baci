import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS, type ThemeColors } from '@/constants/theme';
import { OrderDetailsFooterBar } from './OrderDetailsFooterBar';

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({
    accessibilityElementsHidden,
    importantForAccessibility,
    name,
  }: {
    accessibilityElementsHidden?: boolean;
    importantForAccessibility?: string;
    name: string;
  }) => (
    <svg
      aria-hidden={accessibilityElementsHidden ? 'true' : 'false'}
      data-important={importantForAccessibility}
      data-testid={name}
    />
  ),
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Pressable: ({
      accessibilityLabel,
      accessibilityRole,
      children,
      onPress,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      children?: ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'div',
        {
          'aria-label': accessibilityLabel,
          onClick: () => onPress?.(),
          role: accessibilityRole,
        },
        children
      ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: ReactNode }) =>
      React.createElement('div', null, children),
  };
});

describe('OrderDetailsFooterBar', () => {
  const colors = {
    ...LIGHT_COLORS,
  } satisfies ThemeColors;

  it('renders the current status and handles the update action', () => {
    const onPress = vi.fn();

    render(
      <OrderDetailsFooterBar
        colors={colors}
        currentStatusLabel="Processing"
        onPress={onPress}
        statusColor="#2563eb"
      />
    );

    expect(screen.getByText('Current Status')).toBeInTheDocument();
    expect(screen.getByText('Processing')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Update order status' })
    );

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('marks the chevron as decorative', () => {
    render(
      <OrderDetailsFooterBar
        colors={colors}
        currentStatusLabel="Shipped"
        onPress={vi.fn()}
        statusColor="#7c3aed"
      />
    );

    expect(screen.getByTestId('chevron-up')).toHaveAttribute(
      'aria-hidden',
      'true'
    );
    expect(screen.getByTestId('chevron-up')).toHaveAttribute(
      'data-important',
      'no'
    );
  });
});
