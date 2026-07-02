import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import { TransactionOrderProfitSummary } from './TransactionOrderProfitSummary';

vi.mock('react-native', async () => {
  const React = await import('react');
  const getDomStyle = (style: unknown) => {
    if (Array.isArray(style)) {
      return Object.assign(
        {},
        ...style.filter(
          (entry): entry is Record<string, string | number> =>
            Boolean(entry) && typeof entry === 'object'
        )
      );
    }

    return style && typeof style === 'object' ? style : undefined;
  };

  return {
    Text: ({
      children,
      style,
    }: {
      children?: React.ReactNode;
      style?: unknown;
    }) => React.createElement('span', { style: getDomStyle(style) }, children),
    View: ({
      children,
      style,
    }: {
      children?: React.ReactNode;
      style?: unknown;
    }) => React.createElement('div', { style: getDomStyle(style) }, children),
  };
});

describe('TransactionOrderProfitSummary', () => {
  it('does not render for a single item order', () => {
    const { container } = render(
      <TransactionOrderProfitSummary
        colors={LIGHT_COLORS}
        estimatedProfit={1200}
        formatCurrency={(amount) => `NGN ${amount}`}
        itemCount={1}
        missingCostCount={0}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders total profit for orders with multiple items', () => {
    render(
      <TransactionOrderProfitSummary
        colors={LIGHT_COLORS}
        estimatedProfit={4800}
        formatCurrency={(amount) => `NGN ${amount}`}
        itemCount={2}
        missingCostCount={0}
      />
    );

    expect(screen.getByText('Total profit')).toBeInTheDocument();
    expect(screen.getByText('NGN 4800')).toHaveStyle({
      color: LIGHT_COLORS.success,
    });
  });

  it('renders total loss in red for multi-item loss orders', () => {
    render(
      <TransactionOrderProfitSummary
        colors={LIGHT_COLORS}
        estimatedProfit={-500}
        formatCurrency={(amount) => `NGN ${amount}`}
        itemCount={3}
        missingCostCount={0}
      />
    );

    expect(screen.getByText('Total loss')).toBeInTheDocument();
    expect(screen.getByText('Loss NGN 500')).toHaveStyle({
      color: LIGHT_COLORS.error,
    });
  });

  it('renders neutral multi-item profit totals with muted text', () => {
    render(
      <TransactionOrderProfitSummary
        colors={LIGHT_COLORS}
        estimatedProfit={0}
        formatCurrency={(amount) => `NGN ${amount}`}
        itemCount={2}
        missingCostCount={0}
      />
    );

    expect(screen.getByText('Total profit')).toBeInTheDocument();
    expect(screen.getByText('NGN 0')).toHaveStyle({
      color: LIGHT_COLORS.textMuted,
    });
  });

  it('labels incomplete multi-item totals as estimates', () => {
    render(
      <TransactionOrderProfitSummary
        colors={LIGHT_COLORS}
        estimatedProfit={2500}
        formatCurrency={(amount) => `NGN ${amount}`}
        itemCount={3}
        missingCostCount={1}
      />
    );

    expect(screen.getByText('Estimated profit')).toBeInTheDocument();
    expect(screen.queryByText('Total profit')).not.toBeInTheDocument();
  });
});
