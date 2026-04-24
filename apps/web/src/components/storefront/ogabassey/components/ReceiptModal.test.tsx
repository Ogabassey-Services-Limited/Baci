import type { ReceiptMerchant, ReceiptOrder } from '@baci/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ReceiptModal } from './ReceiptModal';

vi.mock('@baci/shared', async () => {
  const actual = await vi.importActual<typeof import('@baci/shared')>(
    '@baci/shared'
  );

  return {
    ...actual,
    generateReceiptHtml: vi.fn(() => '<html><body>Document</body></html>'),
  };
});

const merchant: ReceiptMerchant = {
  bank_account_number: null,
  bank_code: null,
  business_address: null,
  business_name: 'Baci Store',
  cac_rc_number: null,
  email: 'store@example.com',
  legal_entity_name: null,
  logo_url: null,
  phone: null,
  support_email: null,
  support_phone: null,
  tax_identification_number: null,
  vat_rate: null,
  vat_registration_status: null,
};

type PaymentStatus = 'failed' | 'paid' | 'partially_paid' | 'pending' | 'refunded';
type DocumentLabel = 'invoice' | 'receipt';

const modalVariants: Array<{
  label: DocumentLabel;
  paymentStatus: PaymentStatus;
}> = [
  { label: 'receipt', paymentStatus: 'paid' },
  { label: 'invoice', paymentStatus: 'pending' },
];

function createOrder(paymentStatus: PaymentStatus): ReceiptOrder {
  return {
    amount_paid: paymentStatus === 'paid' ? 1500 : 0,
    balance: paymentStatus === 'paid' ? 0 : 1500,
    created_at: '2026-04-24T10:00:00Z',
    currency: 'NGN',
    customer_email: 'customer@example.com',
    customer_name: 'Customer',
    customer_phone: null,
    discount_amount: 0,
    items: [{ price: 1500, product_name: 'Phone Case', quantity: 1 }],
    order_number: 'ORD-001',
    payment_method: null,
    payment_status: paymentStatus,
    shipping_fee: 0,
    subtotal: 1500,
    tax_amount: 0,
    total: 1500,
  };
}

describe('ReceiptModal', () => {
  it('labels actions as receipt controls for paid orders', () => {
    render(
      <ReceiptModal
        isOpen
        merchantData={merchant}
        onClose={vi.fn()}
        orderData={createOrder('paid')}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Print receipt' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Close receipt' })
    ).toBeInTheDocument();
  });

  it.each<PaymentStatus>(['pending', 'partially_paid', 'failed', 'refunded'])(
    'labels actions as invoice controls for %s orders',
    (paymentStatus) => {
      render(
        <ReceiptModal
          isOpen
          merchantData={merchant}
          onClose={vi.fn()}
          orderData={createOrder(paymentStatus)}
        />
      );

      expect(
        screen.getByRole('button', { name: 'Print invoice' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Close invoice' })
      ).toBeInTheDocument();
    }
  );

  it('closes paid receipt modals from the document-specific close button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <ReceiptModal
        isOpen
        merchantData={merchant}
        onClose={onClose}
        orderData={createOrder('paid')}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Close receipt' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes unpaid invoice modals from the document-specific close button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <ReceiptModal
        isOpen
        merchantData={merchant}
        onClose={onClose}
        orderData={createOrder('pending')}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Close invoice' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('prints the embedded document from the print control', async () => {
    const user = userEvent.setup();
    const print = vi.fn();

    render(
      <ReceiptModal
        isOpen
        merchantData={merchant}
        onClose={vi.fn()}
        orderData={createOrder('paid')}
      />
    );

    const iframe = screen.getByTitle('Receipt #ORD-001') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { print },
    });

    await user.click(screen.getByRole('button', { name: 'Print receipt' }));

    expect(print).toHaveBeenCalledTimes(1);
  });

  it.each(modalVariants)(
    'closes the $label modal when Escape is pressed',
    async ({ label, paymentStatus }) => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <ReceiptModal
          isOpen
          merchantData={merchant}
          onClose={onClose}
          orderData={createOrder(paymentStatus)}
        />
      );

      await user.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(
        screen.getByRole('button', { name: `Print ${label}` })
      ).toHaveFocus();
    }
  );

  it('restores focus to the previously focused element after closing', () => {
    const TriggerHarness = ({ isOpen }: { isOpen: boolean }) => (
      <>
        <button type="button">Open receipt</button>
        <ReceiptModal
          isOpen={isOpen}
          merchantData={merchant}
          onClose={vi.fn()}
          orderData={createOrder('paid')}
        />
      </>
    );

    const { rerender } = render(<TriggerHarness isOpen={false} />);
    const triggerButton = screen.getByRole('button', { name: 'Open receipt' });
    triggerButton.focus();

    rerender(<TriggerHarness isOpen />);

    expect(screen.getByRole('button', { name: 'Print receipt' })).toHaveFocus();

    rerender(<TriggerHarness isOpen={false} />);

    expect(triggerButton).toHaveFocus();
  });

  it.each(modalVariants)(
    'keeps keyboard focus inside the $label modal',
    async ({ label, paymentStatus }) => {
      const user = userEvent.setup();

      render(
        <ReceiptModal
          isOpen
          merchantData={merchant}
          onClose={vi.fn()}
          orderData={createOrder(paymentStatus)}
        />
      );

      const printButton = screen.getByRole('button', {
        name: `Print ${label}`,
      });
      const closeButton = screen.getByRole('button', {
        name: `Close ${label}`,
      });

      expect(printButton).toHaveFocus();

      await user.tab();
      expect(closeButton).toHaveFocus();

      await user.tab();
      expect(printButton).toHaveFocus();

      await user.keyboard('{Shift>}{Tab}{/Shift}');
      expect(closeButton).toHaveFocus();
    }
  );

  it('does not render controls when the modal is closed', () => {
    render(
      <ReceiptModal
        isOpen={false}
        merchantData={merchant}
        onClose={vi.fn()}
        orderData={createOrder('paid')}
      />
    );

    expect(
      screen.queryByRole('button', { name: 'Print receipt' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Close receipt' })
    ).not.toBeInTheDocument();
  });
});
