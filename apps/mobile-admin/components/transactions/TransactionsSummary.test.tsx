import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import { TransactionsSummary } from './TransactionsSummary';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Pressable: ({
      accessibilityLabel,
      accessibilityRole,
      accessibilityState,
      children,
      onPress,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      accessibilityState?: { selected?: boolean };
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-label': accessibilityLabel,
          'aria-pressed': accessibilityState?.selected,
          role: accessibilityRole,
          onClick: () => onPress?.(),
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

describe('TransactionsSummary', () => {
  it('renders paid and missing-cost summary cards as selectable tabs', () => {
    const onTabChange = vi.fn();

    render(
      <TransactionsSummary
        activeTab="paid"
        colors={LIGHT_COLORS}
        estimatedProfitLabel="NGN 1500"
        onTabChange={onTabChange}
        summary={{ missingCosts: 2, transactions: 5 }}
      />
    );

    const paidTab = screen.getByRole('tab', {
      name: /paid transactions: 5/i,
    });
    const missingCostsTab = screen.getByRole('tab', {
      name: /missing costs: 2/i,
    });

    expect(paidTab).toHaveAttribute('aria-pressed', 'true');
    expect(missingCostsTab).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(missingCostsTab);

    expect(onTabChange).toHaveBeenCalledWith('missing-costs');
  });
});
