import { Alert } from 'react-native';
import type { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderItem } from '@/components/orders/new-order.types';

const mocks = vi.hoisted(() => ({
  createManualOrderWithItems: vi.fn(),
  alert: vi.fn(),
  invalidateQueries: vi.fn(),
}));

vi.mock('react-native', () => ({
  Alert: { alert: mocks.alert },
}));

vi.mock('@/lib/manual-order-persistence', () => ({
  createManualOrderWithItems: mocks.createManualOrderWithItems,
}));

vi.mock('expo-crypto', () => ({
  randomUUID: () => 'uuid-123456',
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { submitNewOrder } from './submitNewOrder';

function createOrderItem(overrides: Partial<OrderItem>): OrderItem {
  return {
    id: 'item-1',
    name: 'Phone',
    price: 0,
    product_id: 'product-1',
    quantity: 1,
    variant_id: null,
    variant_name: null,
    ...overrides,
  };
}

describe('submitNewOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createManualOrderWithItems.mockResolvedValue({ id: 'order-1' });
  });

  it('blocks submission when the customer is missing', async () => {
    await submitNewOrder({
      customer: { address: '', email: '', id: null, name: '', phone: '' },
      deliveryInfo: { address: '', city: '', name: '', phone: '', state: '' },
      discount: 0,
      merchantId: 'merchant-1',
      notes: '',
      orderItems: [],
      partialAmount: '',
      paymentMethod: '',
      paymentStatus: 'pending',
      queryClient: {
        invalidateQueries: mocks.invalidateQueries,
      } as unknown as QueryClient,
      sameAsCustomer: true,
      selectedChannel: 'website',
      setIsSubmitting: vi.fn(),
      setLastOrderId: vi.fn(),
      setShowSuccessModal: vi.fn(),
      shippingFee: 0,
      subtotal: 0,
      taxesToUse: 0,
      total: 0,
      submittingRef: { current: false },
      userId: 'user-1',
    });

    expect(mocks.alert).toHaveBeenCalledWith(
      'Required',
      'Please select a customer for this order'
    );
    expect(mocks.createManualOrderWithItems).not.toHaveBeenCalled();
  });

  it('creates the order, invalidates queries, and shows success', async () => {
    const setIsSubmitting = vi.fn();
    const setLastOrderId = vi.fn();
    const setShowSuccessModal = vi.fn();

    await submitNewOrder({
      customer: {
        address: '1 Baci Street',
        email: 'customer@example.com',
        id: 'customer-1',
        name: 'Ada Merchant',
        phone: '08030000000',
      },
      deliveryInfo: { address: '', city: '', name: '', phone: '', state: '' },
      discount: 0,
      merchantCurrency: 'NGN',
      merchantId: 'merchant-1',
      notes: 'Handle with care',
      orderItems: [createOrderItem({ price: 12000 })],
      partialAmount: '',
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      queryClient: {
        invalidateQueries: mocks.invalidateQueries,
      } as unknown as QueryClient,
      sameAsCustomer: true,
      selectedChannel: 'website',
      setIsSubmitting,
      setLastOrderId,
      setShowSuccessModal,
      shippingFee: 0,
      subtotal: 12000,
      taxesToUse: 0,
      total: 12000,
      submittingRef: { current: false },
      userId: 'user-1',
    });

    expect(mocks.createManualOrderWithItems).toHaveBeenCalledWith(
      expect.objectContaining({
        deleteOrder: expect.any(Function),
        insertOrder: expect.any(Function),
        insertOrderItems: expect.any(Function),
      }),
      expect.objectContaining({
        buildItems: expect.any(Function),
        order: expect.objectContaining({
          amount_paid: 12000,
          currency: 'NGN',
          customer_email: 'customer@example.com',
          customer_id: 'customer-1',
          customer_name: 'Ada Merchant',
          customer_phone: '08030000000',
          discount_amount: 0,
          merchant_id: 'merchant-1',
          notes: 'Handle with care',
          order_number: expect.stringMatching(/^ORD-/),
          payment_method: 'cash',
          payment_status: 'paid',
          recorded_by_user_id: 'user-1',
          shipping_address: expect.objectContaining({
            address: '1 Baci Street',
            name: 'Ada Merchant',
            phone: '08030000000',
          }),
          shipping_fee: 0,
          shipping_status: 'pending',
          source: 'website',
          subtotal: 12000,
          tax_amount: 0,
          total: 12000,
        }),
      })
    );
    expect(mocks.invalidateQueries).toHaveBeenCalledTimes(3);
    expect(setLastOrderId).toHaveBeenCalledWith('order-1');
    expect(setShowSuccessModal).toHaveBeenCalledWith(true);
    expect(setIsSubmitting).toHaveBeenCalledWith(true);
    expect(setIsSubmitting).toHaveBeenLastCalledWith(false);
  });

  it('handles createManualOrderWithItems failure gracefully', async () => {
    const setIsSubmitting = vi.fn();
    const setLastOrderId = vi.fn();
    const setShowSuccessModal = vi.fn();
    mocks.createManualOrderWithItems.mockRejectedValueOnce(
      new Error('Create failed')
    );

    await submitNewOrder({
      customer: {
        address: '1 Baci Street',
        email: 'customer@example.com',
        id: 'customer-1',
        name: 'Ada Merchant',
        phone: '08030000000',
      },
      deliveryInfo: { address: '', city: '', name: '', phone: '', state: '' },
      discount: 0,
      merchantCurrency: 'NGN',
      merchantId: 'merchant-1',
      notes: 'Handle with care',
      orderItems: [createOrderItem({ price: 12000 })],
      partialAmount: '',
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      queryClient: {
        invalidateQueries: mocks.invalidateQueries,
      } as unknown as QueryClient,
      sameAsCustomer: true,
      selectedChannel: 'website',
      setIsSubmitting,
      setLastOrderId,
      setShowSuccessModal,
      shippingFee: 0,
      subtotal: 12000,
      taxesToUse: 0,
      total: 12000,
      submittingRef: { current: false },
      userId: 'user-1',
    });

    expect(mocks.alert).toHaveBeenCalledWith('Error', 'Create failed');
    expect(setIsSubmitting).toHaveBeenLastCalledWith(false);
    expect(setShowSuccessModal).not.toHaveBeenCalled();
    expect(setLastOrderId).not.toHaveBeenCalled();
  });
});
