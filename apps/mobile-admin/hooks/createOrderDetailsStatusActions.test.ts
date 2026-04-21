import { Alert } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
}));

vi.mock('@/lib/api-client', () => ({
  BASE_URL: 'https://example.com',
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
    },
  },
}));

import { createOrderDetailsStatusActions } from './createOrderDetailsStatusActions';

describe('createOrderDetailsStatusActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mocks.fetch);
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token' } },
    });
    mocks.fetch.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens the payment options dialog when processing an unpaid order', async () => {
    const setShowStatusModal = vi.fn();
    const setShowPaymentOptionModal = vi.fn();
    const actions = createOrderDetailsStatusActions({
      openShipmentFlow: vi.fn(),
      order: {
        id: 'order-1',
        amount_paid: 0,
        balance: 10000,
        created_at: '',
        customer_email: 'customer@example.com',
        customer_name: 'Ada',
        customer_phone: null,
        discount_amount: 0,
        is_credit_order: false,
        order_number: 'ORD-1',
        payment_status: 'pending',
        shipping_address: null,
        shipping_status: 'pending',
        total: 10000,
        updated_at: '',
      },
      setShowCreditModal: vi.fn(),
      setShowPaymentOptionModal,
      setShowStatusModal,
      setSuccessModal: vi.fn(),
      updateStatus: vi.fn(),
    });

    await actions.handleStatusUpdate('processing');

    expect(setShowStatusModal).toHaveBeenCalledWith(false);
    expect(setShowPaymentOptionModal).toHaveBeenCalledWith(true);
  });

  it('updates status and records success feedback for delivered orders', async () => {
    const setSuccessModal = vi.fn();
    const updateStatus = vi.fn().mockResolvedValue(undefined);
    const actions = createOrderDetailsStatusActions({
      openShipmentFlow: vi.fn(),
      order: {
        id: 'order-1',
        amount_paid: 10000,
        balance: 0,
        created_at: '',
        customer_email: 'customer@example.com',
        customer_name: 'Ada',
        customer_phone: null,
        discount_amount: 0,
        is_credit_order: false,
        order_number: 'ORD-1',
        payment_status: 'paid',
        shipping_address: null,
        shipping_status: 'shipped',
        total: 10000,
        updated_at: '',
      },
      setShowCreditModal: vi.fn(),
      setShowPaymentOptionModal: vi.fn(),
      setShowStatusModal: vi.fn(),
      setSuccessModal,
      updateStatus,
    });

    await actions.handleStatusUpdate('delivered');

    expect(updateStatus).toHaveBeenCalledWith({
      orderId: 'order-1',
      status: 'delivered',
    });
    expect(setSuccessModal).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Order Delivered! 🎉',
        visible: true,
      })
    );
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});
