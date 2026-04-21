import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OrderDetailsFooterBar } from './OrderDetailsFooterBar';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
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
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-label': accessibilityLabel,
          onClick: () => onPress?.(),
          role: accessibilityRole,
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
  };

  it('renders the current status label', () => {
    render(
      <OrderDetailsFooterBar
        colors={
          colors as unknown as React.ComponentProps<
            typeof OrderDetailsFooterBar
          >['colors']
        }
        currentStatusLabel="Pending"
        onPress={vi.fn()}
        statusColor="#ca8a04"
      />
    );

    expect(screen.getByText('Current Status')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('invokes onPress when the Update Status button is pressed', () => {
    const onPress = vi.fn();

    render(
      <OrderDetailsFooterBar
        colors={
          colors as unknown as React.ComponentProps<
            typeof OrderDetailsFooterBar
          >['colors']
        }
        currentStatusLabel="Processing"
        onPress={onPress}
        statusColor="#2563eb"
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Update order status' })
    );

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
