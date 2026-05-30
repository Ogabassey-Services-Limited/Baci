import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderDetailsRecord } from '@/components/orders/order-details.types';

const asyncStorageMock = vi.hoisted(() => ({
  getItem: vi.fn<(key: string) => Promise<string | null>>(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}));

vi.mock('@/lib/storage', () => ({
  asyncStorage: asyncStorageMock,
}));

vi.mock('@/lib/validators/storage', () => ({
  parseSavedRiders: vi.fn((value: string | null) =>
    value ? JSON.parse(value) : []
  ),
}));

import { useOrderDetailsStartupEffects } from './useOrderDetailsStartupEffects';

type HookParams = Parameters<typeof useOrderDetailsStartupEffects>[0];

function buildParams(overrides: Partial<HookParams> = {}): HookParams {
  return {
    actionParam: undefined,
    order: null,
    setPaymentAmount: vi.fn(),
    setSavedRiders: vi.fn(),
    setShowCreditModal: vi.fn(),
    setShowRecordPaymentModal: vi.fn(),
    ...overrides,
  };
}

function buildOrder(
  overrides: Partial<OrderDetailsRecord> = {}
): OrderDetailsRecord {
  return {
    amount_paid: 0,
    balance: 5000,
    created_at: '2026-05-30T00:00:00.000Z',
    customer_email: 'customer@example.com',
    customer_name: 'Customer Name',
    customer_phone: '+2348000000000',
    discount_amount: 0,
    id: 'order-1',
    order_number: 'ORD-001',
    payment_status: 'unpaid',
    shipping_address: null,
    shipping_status: 'pending',
    total: 5000,
    updated_at: '2026-05-30T00:00:00.000Z',
    ...overrides,
  };
}

describe('useOrderDetailsStartupEffects', () => {
  beforeEach(() => {
    asyncStorageMock.getItem.mockReset();
    asyncStorageMock.getItem.mockResolvedValue(null);
  });

  it('opens record-payment modal when actionParam is record-payment and order is loaded', () => {
    const setShowRecordPaymentModal = vi.fn();
    const setPaymentAmount = vi.fn();

    renderHook(() =>
      useOrderDetailsStartupEffects(
        buildParams({
          actionParam: 'record-payment',
          order: buildOrder(),
          setPaymentAmount,
          setShowRecordPaymentModal,
        })
      )
    );

    expect(setShowRecordPaymentModal).toHaveBeenCalledWith(true);
    expect(setPaymentAmount).toHaveBeenCalledWith('5000');
  });

  it('opens credit modal when actionParam is ship-on-credit', () => {
    const setShowCreditModal = vi.fn();

    renderHook(() =>
      useOrderDetailsStartupEffects(
        buildParams({
          actionParam: 'ship-on-credit',
          order: buildOrder(),
          setShowCreditModal,
        })
      )
    );

    expect(setShowCreditModal).toHaveBeenCalledWith(true);
  });

  it('loads saved riders from AsyncStorage on mount', async () => {
    asyncStorageMock.getItem.mockResolvedValue(
      JSON.stringify(['+2348000000001', '+2348000000002'])
    );
    const setSavedRiders = vi.fn();

    renderHook(() =>
      useOrderDetailsStartupEffects(buildParams({ setSavedRiders }))
    );

    await waitFor(() => {
      expect(setSavedRiders).toHaveBeenCalledWith([
        '+2348000000001',
        '+2348000000002',
      ]);
    });

    expect(asyncStorageMock.getItem).toHaveBeenCalledWith('saved_riders');
  });

  it('does not reopen the record payment modal when the same order refetches as a new object', async () => {
    const setPaymentAmount = vi.fn();
    const setSavedRiders = vi.fn();
    const setShowCreditModal = vi.fn();
    const setShowRecordPaymentModal = vi.fn();

    const order = buildOrder({
      amount_paid: 2000,
      balance: 8000,
      total: 10000,
    });

    const { rerender } = renderHook(
      ({
        actionParam,
        nextOrder,
      }: {
        actionParam?: 'record-payment' | 'ship-on-credit';
        nextOrder?: OrderDetailsRecord | null;
      }) =>
        useOrderDetailsStartupEffects(
          buildParams({
            actionParam,
            order: nextOrder,
            setPaymentAmount,
            setSavedRiders,
            setShowCreditModal,
            setShowRecordPaymentModal,
          })
        ),
      {
        initialProps: {
          actionParam: 'record-payment' as const,
          nextOrder: order,
        },
      }
    );

    await waitFor(() => {
      expect(setShowRecordPaymentModal).toHaveBeenCalledTimes(1);
    });
    expect(setPaymentAmount).toHaveBeenCalledWith('8000');

    rerender({
      actionParam: 'record-payment' as const,
      nextOrder: { ...order },
    });

    await waitFor(() => {
      expect(setShowRecordPaymentModal).toHaveBeenCalledTimes(1);
    });
    expect(setPaymentAmount).toHaveBeenCalledTimes(1);
  });
});
