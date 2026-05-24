import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { useNewOrderController } from '@/hooks/useNewOrderController';
import { NewOrderFooterBar } from './NewOrderFooterBar';

vi.mock('@react-native-vector-icons/ionicons/static', () => ({
  Ionicons: () => null,

  default: () => null,
  __esModule: true,
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
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      onChangeText,
      placeholder,
      value,
    }: {
      onChangeText?: (value: string) => void;
      placeholder?: string;
      value?: string;
    }) =>
      React.createElement('input', {
        'aria-label': placeholder,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
        value: value ?? '',
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('./new-order.styles', () => ({ styles: {} }));

type FooterController = Pick<
  ReturnType<typeof useNewOrderController>,
  | 'colors'
  | 'formatPrice'
  | 'handleSubmit'
  | 'isSubmitting'
  | 'orderItems'
  | 'partialAmount'
  | 'paymentMethod'
  | 'paymentStatus'
  | 'setPartialAmount'
  | 'setPaymentMethod'
  | 'setPaymentStatus'
  | 'total'
>;

function makeController(
  overrides: Partial<FooterController> = {}
): ReturnType<typeof useNewOrderController> {
  return {
    colors: {
      background: '#f8fafc',
      border: '#e2e8f0',
      card: '#ffffff',
      error: '#dc2626',
      inputBg: '#f1f5f9',
      primary: '#2563eb',
      success: '#16a34a',
      text: '#0f172a',
      textMuted: '#94a3b8',
      textOnPrimary: '#ffffff',
      textSecondary: '#64748b',
      warning: '#d97706',
    },
    formatPrice: (amount: number) => `₦${amount.toFixed(2)}`,
    handleSubmit: vi.fn(),
    isSubmitting: false,
    orderItems: [
      {
        id: 'item-1',
        name: 'Baci Phone',
        price: 2000,
        product_id: 'product-1',
        quantity: 1,
        variant_id: null,
        variant_name: null,
      },
    ],
    partialAmount: '',
    paymentMethod: 'transfer',
    paymentStatus: 'unpaid',
    setPartialAmount: vi.fn(),
    setPaymentMethod: vi.fn(),
    setPaymentStatus: vi.fn(),
    total: 5000,
    ...overrides,
  } as ReturnType<typeof useNewOrderController>;
}

describe('NewOrderFooterBar', () => {
  it('disables save when there are no order items and shows the formatted total', () => {
    const controller = makeController({ orderItems: [] });

    render(<NewOrderFooterBar controller={controller} />);

    expect(screen.getByText('Total Amount')).toBeInTheDocument();
    expect(screen.getByText('₦5000.00')).toBeInTheDocument();
    expect(screen.getByText('Save Order').closest('button')).toBeDisabled();
  });

  it('shows partial-payment controls and forwards payment method and amount changes', () => {
    const controller = makeController({
      partialAmount: '4000',
      paymentStatus: 'partially_paid',
    });

    render(<NewOrderFooterBar controller={controller} />);

    fireEvent.click(screen.getByText('Cash').closest('button')!);
    fireEvent.change(screen.getByRole('textbox', { name: 'Enter amount...' }), {
      target: { value: '4250' },
    });

    expect(controller.setPaymentMethod).toHaveBeenCalledWith('cash');
    expect(controller.setPartialAmount).toHaveBeenCalledWith('4250');
  });

  it('resets partial amount when switching away from partial payments and submits when enabled', () => {
    const controller = makeController({
      partialAmount: '3500',
      paymentStatus: 'partially_paid',
    });

    render(<NewOrderFooterBar controller={controller} />);

    fireEvent.click(screen.getByText('UNPAID').closest('button')!);
    fireEvent.click(screen.getByText('Save Order').closest('button')!);

    expect(controller.setPaymentStatus).toHaveBeenCalledWith('unpaid');
    expect(controller.setPartialAmount).toHaveBeenCalledWith('');
    expect(controller.handleSubmit).toHaveBeenCalledTimes(1);
  });
});
