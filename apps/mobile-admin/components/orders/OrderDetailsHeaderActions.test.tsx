import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { router } from 'expo-router';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OrderDetailsHeaderActions } from './OrderDetailsHeaderActions';

vi.mock('expo-router', () => ({
  router: { push: vi.fn() },
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,
  default: () => null,
  __esModule: true,
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
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

describe('OrderDetailsHeaderActions', () => {
  it('routes to order edit and exposes share action', () => {
    const onShare = vi.fn();
    render(
      <OrderDetailsHeaderActions
        canEditOrder={true}
        colors={{ primary: '#2563eb' }}
        onShare={onShare}
        orderId="order 1"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit order' }));
    fireEvent.click(screen.getByRole('button', { name: 'Share order' }));

    expect(router.push).toHaveBeenCalledWith('/order/edit?id=order%201');
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it('hides edit for terminal orders', () => {
    render(
      <OrderDetailsHeaderActions
        canEditOrder={false}
        colors={{ primary: '#2563eb' }}
        onShare={vi.fn()}
        orderId="order-1"
      />
    );

    expect(
      screen.queryByRole('button', { name: 'Edit order' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Share order' })
    ).toBeInTheDocument();
  });
});
