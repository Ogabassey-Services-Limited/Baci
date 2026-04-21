import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { useNewOrderController } from '@/hooks/useNewOrderController';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

vi.mock('expo-router', () => ({
  router: {
    push: vi.fn(),
  },
}));

vi.mock('@/components/ui/AppSheetModal', () => ({
  AppSheetModal: ({
    children,
    visible,
  }: {
    children?: React.ReactNode;
    visible: boolean;
  }) => (visible ? <section>{children}</section> : null),
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
    TextInput: ({ value }: { value?: string }) =>
      React.createElement('input', { value: value ?? '' }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

import { NewOrderFinancialSheet } from './NewOrderFinancialSheet';

type FinancialController = Pick<
  ReturnType<typeof useNewOrderController>,
  | 'calculatedVat'
  | 'colors'
  | 'financialValue'
  | 'formatPrice'
  | 'isVatApplied'
  | 'merchant'
  | 'setDiscount'
  | 'setFinancialValue'
  | 'setIsVatApplied'
  | 'setShippingFee'
  | 'setShowFinancialModal'
  | 'setTaxes'
  | 'shadows'
  | 'showFinancialModal'
>;

function makeController(
  overrides: Partial<FinancialController> = {}
): ReturnType<typeof useNewOrderController> {
  return {
    calculatedVat: 0,
    colors: {
      backgroundLight: '#eef2ff',
      border: '#e2e8f0',
      card: '#ffffff',
      error: '#dc2626',
      info: '#0284c7',
      inputBg: '#f8fafc',
      primary: '#2563eb',
      text: '#0f172a',
      textMuted: '#94a3b8',
      textOnPrimary: '#ffffff',
      textSecondary: '#64748b',
      ...overrides.colors,
    },
    financialValue: '',
    formatPrice: vi.fn((value: number) => `₦${value.toFixed(2)}`),
    isVatApplied: false,
    merchant: {
      payout_currency: 'NGN',
      vat_registration_status: 'not_registered',
    } as FinancialController['merchant'],
    setDiscount: vi.fn(),
    setFinancialValue: vi.fn(),
    setIsVatApplied: vi.fn(),
    setShippingFee: vi.fn(),
    setShowFinancialModal: vi.fn(),
    setTaxes: vi.fn(),
    shadows: { sm: {} },
    showFinancialModal: { type: 'shipping', visible: true },
    ...overrides,
  } as ReturnType<typeof useNewOrderController>;
}

describe('NewOrderFinancialSheet', () => {
  it('renders the amount label with the merchant currency code', () => {
    const controller = makeController({
      merchant: {
        payout_currency: 'USD',
        vat_registration_status: 'not_registered',
      } as FinancialController['merchant'],
      showFinancialModal: { type: 'discount', visible: true },
    });

    render(<NewOrderFinancialSheet controller={controller} />);

    expect(screen.getByText('Amount (USD)')).toBeInTheDocument();
  });

  it('falls back to a currency-neutral amount label when no currency is set', () => {
    const controller = makeController({
      merchant: {
        payout_currency: '   ',
        vat_registration_status: 'not_registered',
      } as FinancialController['merchant'],
      showFinancialModal: { type: 'discount', visible: true },
    });

    render(<NewOrderFinancialSheet controller={controller} />);

    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.queryByText('Amount (NGN)')).not.toBeInTheDocument();
  });

  it('does not persist calculated VAT into manual taxes when VAT mode is enabled', () => {
    const controller = makeController({
      calculatedVat: 1250,
      financialValue: '1250',
      isVatApplied: true,
      merchant: {
        payout_currency: 'NGN',
        vat_registration_status: 'registered',
      } as FinancialController['merchant'],
      showFinancialModal: { type: 'tax', visible: true },
    });

    render(<NewOrderFinancialSheet controller={controller} />);

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(controller.setTaxes).not.toHaveBeenCalled();
    expect(controller.setShowFinancialModal).toHaveBeenCalledWith({
      type: 'tax',
      visible: false,
    });
  });

  it('persists manual tax values when VAT mode is disabled', () => {
    const controller = makeController({
      financialValue: '1450',
      isVatApplied: false,
      merchant: {
        payout_currency: 'NGN',
        vat_registration_status: 'registered',
      } as FinancialController['merchant'],
      showFinancialModal: { type: 'tax', visible: true },
    });

    render(<NewOrderFinancialSheet controller={controller} />);

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(controller.setTaxes).toHaveBeenCalledWith(1450);
  });
});
