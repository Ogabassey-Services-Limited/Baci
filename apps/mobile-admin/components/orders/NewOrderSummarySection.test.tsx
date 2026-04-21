import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { useNewOrderController } from '@/hooks/useNewOrderController';
import { NewOrderSummarySection } from './NewOrderSummarySection';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
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
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('./new-order.styles', () => ({ styles: {} }));

type SummaryController = Pick<
  ReturnType<typeof useNewOrderController>,
  | 'colors'
  | 'discount'
  | 'formatPrice'
  | 'isVatApplied'
  | 'setFinancialValue'
  | 'setShowFinancialModal'
  | 'shippingFee'
  | 'subtotal'
  | 'taxes'
  | 'taxesToUse'
  | 'total'
  | 'vatRate'
>;

function makeController(
  overrides: Partial<SummaryController> = {}
): ReturnType<typeof useNewOrderController> {
  return {
    colors: {
      border: '#e2e8f0',
      error: '#dc2626',
      text: '#0f172a',
      textMuted: '#94a3b8',
      textSecondary: '#64748b',
    },
    discount: 500,
    formatPrice: (amount: number) => `₦${amount}`,
    isVatApplied: false,
    setFinancialValue: vi.fn(),
    setShowFinancialModal: vi.fn(),
    shippingFee: 1200,
    subtotal: 10000,
    taxes: 0,
    taxesToUse: 0,
    total: 10700,
    vatRate: 0.075,
    ...overrides,
  } as ReturnType<typeof useNewOrderController>;
}

describe('NewOrderSummarySection', () => {
  it('renders the formatted order totals', () => {
    const controller = makeController();

    render(<NewOrderSummarySection controller={controller} />);

    expect(screen.getByText('Subtotal')).toBeInTheDocument();
    expect(screen.getByText('₦10000')).toBeInTheDocument();
    expect(screen.getByText('- ₦500')).toBeInTheDocument();
    expect(screen.getByText('₦1200')).toBeInTheDocument();
    expect(screen.getByText('Total Amount')).toBeInTheDocument();
    expect(screen.getByText('₦10700')).toBeInTheDocument();
  });

  it('opens the discount and shipping editors with their current values', () => {
    const controller = makeController();

    render(<NewOrderSummarySection controller={controller} />);

    fireEvent.click(screen.getByText('Discount').closest('button')!);
    fireEvent.click(screen.getByText('Shipping Fee').closest('button')!);

    expect(controller.setFinancialValue).toHaveBeenNthCalledWith(1, '500');
    expect(controller.setShowFinancialModal).toHaveBeenNthCalledWith(1, {
      type: 'discount',
      visible: true,
    });
    expect(controller.setFinancialValue).toHaveBeenNthCalledWith(2, '1200');
    expect(controller.setShowFinancialModal).toHaveBeenNthCalledWith(2, {
      type: 'shipping',
      visible: true,
    });
  });

  it('shows the VAT label when enabled and seeds the tax modal with the displayed tax amount', () => {
    const controller = makeController({
      isVatApplied: true,
      taxes: 0,
      taxesToUse: 750,
    });

    render(<NewOrderSummarySection controller={controller} />);

    fireEvent.click(screen.getByText('VAT (7.5%)').closest('button')!);

    expect(controller.setFinancialValue).toHaveBeenCalledWith('');
    expect(controller.setShowFinancialModal).toHaveBeenCalledWith({
      type: 'tax',
      visible: true,
    });
  });

  it('seeds the tax editor from manual taxes instead of the displayed VAT amount', () => {
    const controller = makeController({
      isVatApplied: true,
      taxes: 125,
      taxesToUse: 750,
    });

    render(<NewOrderSummarySection controller={controller} />);

    fireEvent.click(screen.getByText('VAT (7.5%)').closest('button')!);

    expect(controller.setFinancialValue).toHaveBeenCalledWith('125');
    expect(controller.setShowFinancialModal).toHaveBeenCalledWith({
      type: 'tax',
      visible: true,
    });
  });
});
