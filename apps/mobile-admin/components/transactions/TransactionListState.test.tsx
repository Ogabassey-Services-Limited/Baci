import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import { TransactionListState } from './TransactionListState';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    ActivityIndicator: () =>
      React.createElement('div', { role: 'progressbar' }),
    Pressable: ({
      accessibilityLabel,
      accessibilityRole,
      children,
      disabled,
      onPress,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
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
          role: accessibilityRole,
        },
        children
      ),
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@/components/transactions/transactions.styles', () => ({
  styles: new Proxy(
    {},
    {
      get: (_target, property) => property,
    }
  ),
}));

describe('TransactionListState', () => {
  it('renders a retryable error state', () => {
    const onRetry = vi.fn();

    render(
      <TransactionListState
        colors={LIGHT_COLORS}
        error={new Error('network')}
        hasOrders={false}
        isLoading={false}
        isRetrying={false}
        onRetry={onRetry}
        visibleOrderCount={0}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /retry loading/i }));

    expect(
      screen.getByText('Unable to load transactions.')
    ).toBeInTheDocument();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('distinguishes empty and filtered-empty states', () => {
    const props = {
      colors: LIGHT_COLORS,
      error: null,
      isLoading: false,
      isRetrying: false,
      onRetry: vi.fn(),
    };

    const { rerender } = render(
      <TransactionListState
        {...props}
        hasOrders={false}
        visibleOrderCount={0}
      />
    );

    expect(screen.getByText('No transactions yet.')).toBeInTheDocument();

    rerender(
      <TransactionListState {...props} hasOrders={true} visibleOrderCount={0} />
    );

    expect(screen.getByText('No matching transactions.')).toBeInTheDocument();
  });
});
