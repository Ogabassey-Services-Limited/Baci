import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OrderPaymentOptionDialog } from './OrderPaymentOptionDialog';

vi.mock('@/components/ui/AppDialogModal', () => ({
  AppDialogModal: ({
    children,
    onClose,
    visible,
  }: {
    children?: React.ReactNode;
    onClose: () => void;
    visible: boolean;
  }) =>
    visible ? (
      <section aria-label="order-payment-option-dialog">
        <button aria-label="Close dialog" onClick={onClose} type="button" />
        {children}
      </section>
    ) : null,
}));

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

describe('OrderPaymentOptionDialog', () => {
  const colors = {
    border: '#e2e8f0',
    card: '#ffffff',
    primary: '#2563eb',
    text: '#0f172a',
    textOnPrimary: '#ffffff',
    textSecondary: '#64748b',
  };

  it('does not render when hidden', () => {
    render(
      <OrderPaymentOptionDialog
        balanceLabel="₦50,000"
        colors={colors}
        onClose={vi.fn()}
        onRecordPayment={vi.fn()}
        onShipOnCredit={vi.fn()}
        visible={false}
      />
    );

    expect(
      screen.queryByLabelText('order-payment-option-dialog')
    ).not.toBeInTheDocument();
  });

  it('offers both manual payment and ship-on-credit actions', () => {
    const onRecordPayment = vi.fn();
    const onShipOnCredit = vi.fn();

    render(
      <OrderPaymentOptionDialog
        balanceLabel="₦50,000"
        colors={colors}
        onClose={vi.fn()}
        onRecordPayment={onRecordPayment}
        onShipOnCredit={onShipOnCredit}
        visible={true}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Record manual payment' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ship on credit' }));

    expect(onRecordPayment).toHaveBeenCalledTimes(1);
    expect(onShipOnCredit).toHaveBeenCalledTimes(1);
  });

  it('renders the outstanding balance in the description', () => {
    render(
      <OrderPaymentOptionDialog
        balanceLabel="₦50,000"
        colors={colors}
        onClose={vi.fn()}
        onRecordPayment={vi.fn()}
        onShipOnCredit={vi.fn()}
        visible={true}
      />
    );

    expect(
      screen.getByText('This order has an outstanding balance of ₦50,000.')
    ).toBeInTheDocument();
  });

  it('closes from the cancel action', () => {
    const onClose = vi.fn();

    render(
      <OrderPaymentOptionDialog
        balanceLabel="₦50,000"
        colors={colors}
        onClose={onClose}
        onRecordPayment={vi.fn()}
        onShipOnCredit={vi.fn()}
        visible={true}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Cancel payment option dialog' })
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
