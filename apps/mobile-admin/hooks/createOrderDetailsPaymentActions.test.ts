import { Alert } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOrderDetailsPaymentActions } from './createOrderDetailsPaymentActions';

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
}));

describe('createOrderDetailsPaymentActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes the payment amount input', () => {
    const setPaymentAmount = vi.fn();
    const actions = createOrderDetailsPaymentActions({
      creditNotes: '',
      formatPrice: (amount) => `₦${amount}`,
      order: undefined,
      paymentAmount: '',
      paymentMethod: '',
      paymentNotes: '',
      recordPayment: vi.fn(),
      sendReminder: vi.fn(),
      setCreditNotes: vi.fn(),
      setPaymentAmount,
      setPaymentMethod: vi.fn(),
      setPaymentNotes: vi.fn(),
      setShowCreditModal: vi.fn(),
      setShowRecordPaymentModal: vi.fn(),
      shipOnCredit: vi.fn(),
    });

    actions.handlePaymentAmountChange('₦15,000');

    expect(setPaymentAmount).toHaveBeenCalledWith('15000');
  });

  it('records payment and offers ship-on-credit when a balance remains', async () => {
    const setShowCreditModal = vi.fn();
    const actions = createOrderDetailsPaymentActions({
      creditNotes: '',
      formatPrice: (amount) => `₦${amount}`,
      order: {
        id: 'order-1',
        amount_paid: 0,
        balance: 5000,
        created_at: '',
        customer_email: 'customer@example.com',
        customer_name: 'Ada',
        customer_phone: null,
        discount_amount: 0,
        order_number: 'ORD-1',
        payment_status: 'pending',
        shipping_address: null,
        shipping_status: 'pending',
        total: 10000,
        updated_at: '',
      },
      paymentAmount: '5000',
      paymentMethod: 'cash',
      paymentNotes: 'partial',
      recordPayment: vi.fn().mockResolvedValue({ new_balance: 1000 }),
      sendReminder: vi.fn(),
      setCreditNotes: vi.fn(),
      setPaymentAmount: vi.fn(),
      setPaymentMethod: vi.fn(),
      setPaymentNotes: vi.fn(),
      setShowCreditModal,
      setShowRecordPaymentModal: vi.fn(),
      shipOnCredit: vi.fn(),
    });

    await actions.handleRecordPayment();

    const alertArgs = vi
      .mocked(Alert.alert)
      .mock.calls.find(([title]) => title === 'Payment Recorded');
    expect(alertArgs).toBeTruthy();
    const btn = alertArgs?.[2]?.find((b) => b.text === 'Yes, Ship on Credit');
    btn?.onPress?.();
    expect(setShowCreditModal).toHaveBeenCalledWith(true);
  });

  it('alerts when ship-on-credit is requested before the order loads', async () => {
    const actions = createOrderDetailsPaymentActions({
      creditNotes: '',
      formatPrice: (amount) => `₦${amount}`,
      order: undefined,
      paymentAmount: '',
      paymentMethod: '',
      paymentNotes: '',
      recordPayment: vi.fn(),
      sendReminder: vi.fn(),
      setCreditNotes: vi.fn(),
      setPaymentAmount: vi.fn(),
      setPaymentMethod: vi.fn(),
      setPaymentNotes: vi.fn(),
      setShowCreditModal: vi.fn(),
      setShowRecordPaymentModal: vi.fn(),
      shipOnCredit: vi.fn(),
    });

    await actions.handleShipOnCredit();

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Order details are not available yet'
    );
  });

  it('preserves decimal payment input formatting', () => {
    const setPaymentAmount = vi.fn();
    const actions = createOrderDetailsPaymentActions({
      creditNotes: '',
      formatPrice: (amount) => `₦${amount}`,
      order: undefined,
      paymentAmount: '',
      paymentMethod: '',
      paymentNotes: '',
      recordPayment: vi.fn(),
      sendReminder: vi.fn(),
      setCreditNotes: vi.fn(),
      setPaymentAmount,
      setPaymentMethod: vi.fn(),
      setPaymentNotes: vi.fn(),
      setShowCreditModal: vi.fn(),
      setShowRecordPaymentModal: vi.fn(),
      shipOnCredit: vi.fn(),
    });

    actions.handlePaymentAmountChange('₦12,500.75');

    expect(setPaymentAmount).toHaveBeenCalledWith('12500.75');
  });
});
