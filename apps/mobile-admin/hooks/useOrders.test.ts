import { describe, expect, it, vi } from 'vitest';

const orderHookMocks = vi.hoisted(() => ({
  fetchOrderById: vi.fn(),
  fetchOrders: vi.fn(),
  useGenerateDva: vi.fn(),
  useOrder: vi.fn(),
  useOrders: vi.fn(),
  useRecordPayment: vi.fn(),
  useSendReminder: vi.fn(),
  useShipOnCredit: vi.fn(),
  useUpdateOrderStatus: vi.fn(),
}));

vi.mock('./orders/useGenerateDva', () => ({
  useGenerateDva: orderHookMocks.useGenerateDva,
}));

vi.mock('./orders/useOrderDetails', () => ({
  fetchOrderById: orderHookMocks.fetchOrderById,
  useOrder: orderHookMocks.useOrder,
}));

vi.mock('./orders/useOrdersList', () => ({
  fetchOrders: orderHookMocks.fetchOrders,
  useOrders: orderHookMocks.useOrders,
}));

vi.mock('./orders/useRecordPayment', () => ({
  useRecordPayment: orderHookMocks.useRecordPayment,
}));

vi.mock('./orders/useSendReminder', () => ({
  useSendReminder: orderHookMocks.useSendReminder,
}));

vi.mock('./orders/useShipOnCredit', () => ({
  useShipOnCredit: orderHookMocks.useShipOnCredit,
}));

vi.mock('./orders/useOrderStatusUpdate', () => ({
  useUpdateOrderStatus: orderHookMocks.useUpdateOrderStatus,
}));

import * as orderExports from './useOrders';

describe('useOrders public exports', () => {
  it('keeps the legacy order hook import surface available at runtime', () => {
    expect(orderExports.fetchOrderById).toBe(orderHookMocks.fetchOrderById);
    expect(orderExports.fetchOrders).toBe(orderHookMocks.fetchOrders);
    expect(orderExports.useGenerateDva).toBe(orderHookMocks.useGenerateDva);
    expect(orderExports.useOrder).toBe(orderHookMocks.useOrder);
    expect(orderExports.useOrders).toBe(orderHookMocks.useOrders);
    expect(orderExports.useRecordPayment).toBe(orderHookMocks.useRecordPayment);
    expect(orderExports.useSendReminder).toBe(orderHookMocks.useSendReminder);
    expect(orderExports.useShipOnCredit).toBe(orderHookMocks.useShipOnCredit);
    expect(orderExports.useUpdateOrderStatus).toBe(
      orderHookMocks.useUpdateOrderStatus
    );
  });
});
