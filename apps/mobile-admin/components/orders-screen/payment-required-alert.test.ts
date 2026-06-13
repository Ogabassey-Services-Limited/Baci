import { Alert } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order } from '@/hooks/useOrders';
import {
  requiresPaymentPrompt,
  showPaymentRequiredPrompt,
} from './payment-required-alert';

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock('expo-router', () => ({
  router: routerMock,
}));

vi.mock('react-native', () => ({
  Alert: {
    alert: vi.fn(),
  },
}));

const unpaidOrder = {
  id: 'order-1',
  order_number: 'ORD-1',
  payment_status: 'unpaid',
  is_credit_order: false,
} as Order;

describe('payment-required-alert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires a payment prompt before processing unpaid non-credit orders', () => {
    expect(requiresPaymentPrompt('processing', unpaidOrder)).toBe(true);
    expect(
      requiresPaymentPrompt('processing', {
        ...unpaidOrder,
        payment_status: 'paid',
      })
    ).toBe(false);
    expect(
      requiresPaymentPrompt('processing', {
        ...unpaidOrder,
        is_credit_order: true,
      })
    ).toBe(false);
  });

  it('clears the selected order when the prompt is cancelled', () => {
    const onClearSelection = vi.fn();

    showPaymentRequiredPrompt({
      order: unpaidOrder,
      onClearSelection,
    });

    const actions = vi.mocked(Alert.alert).mock.calls[0]?.[2];
    actions?.[0]?.onPress?.();

    expect(onClearSelection).toHaveBeenCalledOnce();
    expect(routerMock.push).not.toHaveBeenCalled();
  });
});
