import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getItem: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: mocks.getItem,
  },
}));

import { useOrderDetailsStartupEffects } from './useOrderDetailsStartupEffects';

describe('useOrderDetailsStartupEffects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getItem.mockResolvedValue(null);
  });

  it('does not reopen the record payment modal when the same order refetches as a new object', async () => {
    const setPaymentAmount = vi.fn();
    const setSavedRiders = vi.fn();
    const setShowCreditModal = vi.fn();
    const setShowRecordPaymentModal = vi.fn();

    const order = {
      amount_paid: 2000,
      balance: 8000,
      total: 10000,
    };

    const { rerender } = renderHook(
      ({
        actionParam,
        nextOrder,
      }: {
        actionParam?: 'record-payment' | 'ship-on-credit';
        nextOrder?: {
          amount_paid: number;
          balance: number;
          total: number;
        } | null;
      }) =>
        useOrderDetailsStartupEffects({
          actionParam,
          order: nextOrder as never,
          setPaymentAmount,
          setSavedRiders,
          setShowCreditModal,
          setShowRecordPaymentModal,
        }),
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
