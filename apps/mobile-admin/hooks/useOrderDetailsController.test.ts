import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const routeParamsState = vi.hoisted(() => ({
  current: { id: '123e4567-e89b-42d3-a456-426614174000' } as { id: string },
}));

const orderState = vi.hoisted(() => ({
  current: undefined as unknown,
}));

vi.mock('expo-router', () => ({
  useLocalSearchParams: () => routeParamsState.current,
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ colors: {}, shadows: {} }),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({ merchant: null }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({}),
}));

vi.mock('@/hooks/useOrders', () => ({
  useOrder: () => ({
    data: orderState.current as never,
    error: null,
    isLoading: false,
  }),
  useUpdateOrderStatus: () => ({ mutateAsync: vi.fn() }),
  useShipOnCredit: () => ({ mutateAsync: vi.fn() }),
  useSendReminder: () => ({ mutateAsync: vi.fn() }),
  useRecordPayment: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('@/lib/order-shipment', () => ({
  orderRequiresFulfillment: vi.fn(() => false),
  formatShippingProviderName: vi.fn(() => null),
  canUseSelectedShippingProvider: vi.fn(() => false),
}));

vi.mock('@/hooks/createOrderDetailsContactActions', () => ({
  createOrderDetailsContactActions: () => ({
    handleCall: vi.fn(),
    handleEmail: vi.fn(),
    handleSaveRider: vi.fn(),
    handleSendOrderDetailsToRider: vi.fn(),
    handleSendRiderToCustomer: vi.fn(),
    handleShare: vi.fn(),
    handleWhatsApp: vi.fn(),
  }),
}));

vi.mock('@/hooks/createOrderDetailsPaymentActions', () => ({
  createOrderDetailsPaymentActions: () => ({
    handlePaymentAmountChange: vi.fn(),
    handleRecordPayment: vi.fn(),
    handleSendReminder: vi.fn(),
    handleShipOnCredit: vi.fn(),
  }),
}));

vi.mock('@/hooks/createOrderDetailsReceiptActions', () => ({
  createOrderDetailsReceiptActions: () => ({
    handleSendReceipt: vi.fn(),
    handleShareReceiptPdf: vi.fn(),
  }),
}));

vi.mock('@/hooks/createOrderDetailsShipmentActions', () => ({
  createOrderDetailsShipmentActions: () => ({
    closeShipmentFlow: vi.fn(),
    handleShipmentFlowBack: vi.fn(),
    handleSubmitSelfFulfillment: vi.fn(),
    openShipmentFlow: vi.fn(),
    proceedFromFulfillmentDetails: vi.fn(),
    proceedFromShipmentMethod: vi.fn(),
  }),
}));

vi.mock('@/hooks/createOrderDetailsStatusActions', () => ({
  createOrderDetailsStatusActions: () => ({
    handleStatusUpdate: vi.fn(),
  }),
}));

vi.mock('@/hooks/useOrderDetailsStartupEffects', () => ({
  useOrderDetailsStartupEffects: vi.fn(),
}));

vi.mock('@/hooks/useOrderDetailsBackHandler', () => ({
  useOrderDetailsBackHandler: vi.fn(),
}));

vi.mock('@/hooks/useOrderDetailsUiState', () => ({
  useOrderDetailsUiState: () => ({
    creditNotes: '',
    fulfillmentDetails: { imei: '', serialNumber: '' },
    isGeneratingReceipt: false,
    isShipmentSubmitting: false,
    paymentAmount: '',
    paymentMethod: '',
    paymentNotes: '',
    pendingShipmentMode: 'provider',
    receiptHtml: '',
    riderPhone: '',
    savedRiders: [],
    selectedOrderItem: null,
    setCreditNotes: vi.fn(),
    setFulfillmentDetails: vi.fn(),
    setIsGeneratingReceipt: vi.fn(),
    setIsShipmentSubmitting: vi.fn(),
    setPaymentAmount: vi.fn(),
    setPaymentMethod: vi.fn(),
    setPaymentNotes: vi.fn(),
    setPendingShipmentMode: vi.fn(),
    setReceiptHtml: vi.fn(),
    setRiderPhone: vi.fn(),
    setSavedRiders: vi.fn(),
    setSelectedOrderItem: vi.fn(),
    setShipmentFlowStep: vi.fn(),
    setShowCreditModal: vi.fn(),
    setShowPaymentOptionModal: vi.fn(),
    setShowReceiptPreview: vi.fn(),
    setShowRecordPaymentModal: vi.fn(),
    setShowShipmentFlow: vi.fn(),
    setShowStatusModal: vi.fn(),
    setSuccessModal: vi.fn(),
    shipmentFlowStep: 'details',
    showCreditModal: false,
    showPaymentOptionModal: false,
    showReceiptPreview: false,
    showRecordPaymentModal: false,
    showShipmentFlow: false,
    showStatusModal: false,
    successModal: {
      actionLabel: '',
      actionVariant: 'default',
      message: '',
      showAction: false,
      subMessage: '',
      title: 'Success!',
      visible: false,
    },
  }),
}));

import { useOrderDetailsController } from './useOrderDetailsController';

describe('useOrderDetailsController', () => {
  it('returns null orderId when route params are invalid', () => {
    orderState.current = undefined;
    routeParamsState.current = { id: 'not-a-uuid' };
    const { result } = renderHook(() => useOrderDetailsController());

    expect(result.current.orderId).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isInvalidRoute).toBe(true);
  });

  it('uses NGN as fallback currency when merchant has no payout_currency', () => {
    orderState.current = undefined;
    routeParamsState.current = { id: '123e4567-e89b-42d3-a456-426614174000' };
    const { result } = renderHook(() => useOrderDetailsController());

    expect(result.current.formatPrice(1000)).toContain('₦');
  });

  it('uses the delivered status config for legacy fulfilled orders', () => {
    routeParamsState.current = { id: '123e4567-e89b-42d3-a456-426614174000' };
    orderState.current = {
      amount_paid: 0,
      created_at: '2026-04-21T00:00:00.000Z',
      currency: 'NGN',
      customer_email: 'ada@example.com',
      customer_name: 'Ada',
      customer_phone: '08000000000',
      discount_amount: 0,
      id: 'order-1',
      merchant_id: 'merchant-1',
      notes: null,
      order_number: 'ORD-1',
      payment_method: null,
      payment_status: 'pending',
      shipping_fee: 0,
      shipping_status: 'fulfilled',
      source: 'website',
      subtotal: 1000,
      tax_amount: 0,
      total: 1000,
      updated_at: '2026-04-21T00:00:00.000Z',
    };

    const { result } = renderHook(() => useOrderDetailsController());

    expect(result.current.shippingConfig.label).toBe('Delivered');
  });
});
