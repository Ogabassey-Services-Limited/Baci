import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
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
      children,
      onPress,
    }: {
      accessibilityLabel?: string;
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-label': accessibilityLabel,
          onClick: () => onPress?.(),
          type: 'button',
        },
        children
      ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

describe('OrderDetailsFooterBar', () => {
  const colors = {
    border: '#e2e8f0',
    card: '#ffffff',
    primary: '#2563eb',
    text: '#0f172a',
    textOnPrimary: '#ffffff',
    textSecondary: '#64748b',
  } as ThemeColors;

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
