import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const asyncStorageMock = vi.hoisted(() => ({
  getItem: vi.fn<(key: string) => Promise<string | null>>(),
  setItem: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: asyncStorageMock,
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
          order: {
            amount_paid: 0,
            balance: 5000,
            id: 'order-1',
            payment_status: 'unpaid',
            total: 5000,
            // biome-ignore lint/suspicious/noExplicitAny: test fixture only needs a subset of OrderDetailsRecord
          } as any,
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
          order: {
            amount_paid: 0,
            balance: 5000,
            id: 'order-1',
            payment_status: 'unpaid',
            total: 5000,
            // biome-ignore lint/suspicious/noExplicitAny: test fixture only needs a subset of OrderDetailsRecord
          } as any,
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
});
