import type { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderItem } from '@/components/orders/new-order.types';

const mocks = vi.hoisted(() => ({
  createManualOrderWithItems: vi.fn(),
  alert: vi.fn(),
  invalidateQueries: vi.fn(),
  supabaseFrom: vi.fn(),
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
    from: mocks.supabaseFrom,
  },
}));

import { submitNewOrder } from './submitNewOrder';

type SubmitNewOrderParams = Parameters<typeof submitNewOrder>[0];

type BranchLookupResponse = {
  data: { id: string } | null;
  error: { message: string } | null;
};

function createBranchQuery(response: BranchLookupResponse) {
  const query = {
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(response),
    select: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

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

function createSubmitParams(
  overrides: Partial<SubmitNewOrderParams> = {}
): SubmitNewOrderParams {
  return {
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
    selectedBranchId: 'branch-1',
    selectedChannel: 'website',
    setIsSubmitting: vi.fn(),
    setLastOrderId: vi.fn(),
    setShowSuccessModal: vi.fn(),
    shippingFee: 0,
    subtotal: 12000,
    submittingRef: { current: false },
    taxesToUse: 0,
    total: 12000,
    userId: 'user-1',
    ...overrides,
  };
}

describe('submitNewOrder', () => {
  let branchQuery: ReturnType<typeof createBranchQuery>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createManualOrderWithItems.mockResolvedValue({ id: 'order-1' });
    branchQuery = createBranchQuery({
      data: { id: 'branch-1' },
      error: null,
    });
    mocks.supabaseFrom.mockReturnValue(branchQuery);
  });

  it('blocks submission when the customer is missing', async () => {
    await submitNewOrder(
      createSubmitParams({
        customer: { address: '', email: '', id: null, name: '', phone: '' },
        orderItems: [],
      })
    );

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

    await submitNewOrder(
      createSubmitParams({
        setIsSubmitting,
        setLastOrderId,
        setShowSuccessModal,
      })
    );

    expect(mocks.supabaseFrom).toHaveBeenCalledWith('branches');
    expect(branchQuery.select).toHaveBeenCalledWith('id');
    expect(branchQuery.eq).toHaveBeenCalledWith('id', 'branch-1');
    expect(branchQuery.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(branchQuery.eq).toHaveBeenCalledWith('active', true);
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
          branch_id: 'branch-1',
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

    // Verify buildItems produces the expected line-item shape
    const payload = mocks.createManualOrderWithItems.mock.calls[0][1] as {
      buildItems: (orderId: string) => unknown[];
    };
    const items = payload.buildItems('order-1');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      name: 'Phone',
      price: 12000,
      quantity: 1,
      order_id: 'order-1',
    });

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

    await submitNewOrder(
      createSubmitParams({
        setIsSubmitting,
        setLastOrderId,
        setShowSuccessModal,
      })
    );

    expect(mocks.alert).toHaveBeenCalledWith('Error', 'Create failed');
    expect(setIsSubmitting).toHaveBeenLastCalledWith(false);
    expect(setShowSuccessModal).not.toHaveBeenCalled();
    expect(setLastOrderId).not.toHaveBeenCalled();
  });

  it('rejects a selected branch that is not active for the merchant', async () => {
    const setIsSubmitting = vi.fn();
    branchQuery = createBranchQuery({ data: null, error: null });
    mocks.supabaseFrom.mockReturnValue(branchQuery);

    await submitNewOrder(
      createSubmitParams({
        selectedBranchId: 'branch-from-another-merchant',
        setIsSubmitting,
      })
    );

    expect(mocks.supabaseFrom).toHaveBeenCalledWith('branches');
    expect(branchQuery.eq).toHaveBeenCalledWith(
      'id',
      'branch-from-another-merchant'
    );
    expect(branchQuery.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(branchQuery.eq).toHaveBeenCalledWith('active', true);
    expect(mocks.createManualOrderWithItems).not.toHaveBeenCalled();
    expect(mocks.alert).toHaveBeenCalledWith(
      'Error',
      'Selected branch is not available for this merchant'
    );
    expect(setIsSubmitting).toHaveBeenLastCalledWith(false);
  });
});
