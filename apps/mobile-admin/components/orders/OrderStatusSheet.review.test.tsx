import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OrderStatusSheet } from './OrderStatusSheet';

vi.mock('@/components/ui/AppSheetModal', () => ({
  AppSheetModal: ({
    children,
    visible,
  }: {
    children?: React.ReactNode;
    visible: boolean;
  }) => (visible ? <section>{children}</section> : null),
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Pressable: ({
      accessibilityLabel,
      children,
      disabled,
      onPress,
    }: {
      accessibilityLabel?: string;
      children?: React.ReactNode;
      disabled?: boolean;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-label': accessibilityLabel,
          disabled,
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

describe('OrderStatusSheet transitions', () => {
  const colors = {
    border: '#e2e8f0',
    cancelled: '#dc2626',
    card: '#ffffff',
    delivered: '#16a34a',
    pending: '#ca8a04',
    primary: '#2563eb',
    processing: '#2563eb',
    returned: '#9333ea',
    shipped: '#7c3aed',
    text: '#0f172a',
    textMuted: '#94a3b8',
    textSecondary: '#64748b',
  };

  it('does not expose return processing as an active shipped transition', () => {
    render(
      <OrderStatusSheet
        colors={colors}
        onClose={vi.fn()}
        onSelectStatus={vi.fn()}
        shippingStatus="shipped"
        visible={true}
      />
    );

    const returnAction =
      screen.queryByRole('button', { name: 'Process Return' }) ??
      screen.queryByRole('button', { name: 'Returned' });

    expect(returnAction === null || returnAction.hasAttribute('disabled')).toBe(
      true
    );
  });
});
