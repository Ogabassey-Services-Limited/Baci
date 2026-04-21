import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { useOrderDetailsController } from '@/hooks/useOrderDetailsController';
import { OrderDetailsScreenContent } from './OrderDetailsScreenContent';

vi.mock('expo-router', () => ({
  Stack: {
    Screen: ({
      options,
    }: {
      options?: { headerRight?: () => React.ReactNode };
    }) => options?.headerRight?.() ?? null,
  },
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Pressable: ({
      accessibilityLabel,
      accessibilityRole,
      children,
      onPress,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'div',
        {
          'aria-label': accessibilityLabel,
          onClick: () => onPress?.(),
          role: accessibilityRole,
        },
        children
      ),
    ScrollView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@/components/orders/OrderItemDetailModal', () => ({
  OrderItemDetailModal: () => null,
}));
vi.mock('@/components/orders/OrderPaymentOptionDialog', () => ({
  OrderPaymentOptionDialog: () => null,
}));
vi.mock('@/components/orders/OrderStatusSheet', () => ({
  OrderStatusSheet: () => null,
}));
vi.mock('@/components/orders/RecordPaymentSheet', () => ({
  RecordPaymentSheet: () => null,
}));
vi.mock('@/components/orders/ShipmentFlowSheet', () => ({
  ShipmentFlowSheet: () => null,
}));
vi.mock('@/components/orders/ShipOnCreditDialog', () => ({
  ShipOnCreditDialog: () => null,
}));
vi.mock('@/components/ui/ReceiptPreviewModal', () => ({
  ReceiptPreviewModal: () => null,
}));
vi.mock('@/components/ui/SuccessModal', () => ({
  SuccessModal: () => null,
}));
vi.mock('./OrderDetailsFooterBar', () => ({
  OrderDetailsFooterBar: () => null,
}));
vi.mock('./OrderDetailsItemsAndPaymentSection', () => ({
  OrderDetailsItemsAndPaymentSection: () => null,
}));
vi.mock('./OrderDetailsOverviewSection', () => ({
  OrderDetailsOverviewSection: () => null,
}));
vi.mock('./OrderDetailsShippingSection', () => ({
  OrderDetailsShippingSection: () => null,
}));

function createController() {
  return {
    closeShipmentFlow: vi.fn(),
    colors: {
      background: '#ffffff',
      primary: '#2563eb',
      text: '#0f172a',
    },
    creditNotes: '',
    currencySymbol: '₦',
    formatAddress: vi.fn(() => 'Address'),
    formatDate: vi.fn(() => 'Today'),
    formatPrice: vi.fn((amount: number) => `₦${amount}`),
    fulfillmentDetails: { imei: '', serialNumber: '' },
    handleCall: vi.fn(),
    handleEmail: vi.fn(),
    handlePaymentAmountChange: vi.fn(),
    handleRecordPayment: vi.fn(),
    handleSendOrderDetailsToRider: vi.fn(),
    handleSendReceipt: vi.fn(),
    handleSendReminder: vi.fn(),
    handleSendRiderToCustomer: vi.fn(),
    handleShare: vi.fn(),
    handleShareReceiptPdf: vi.fn(),
    handleShipOnCredit: vi.fn(),
    handleShipmentFlowBack: vi.fn(),
    handleStatusUpdate: vi.fn(),
    handleSubmitSelfFulfillment: vi.fn(),
    handleWhatsApp: vi.fn(),
    isGeneratingReceipt: false,
    isShipmentSubmitting: false,
    order: {
      amount_paid: 0,
      balance: 10000,
      created_at: '2024-01-01T00:00:00.000Z',
      customer_email: 'customer@example.com',
      customer_name: 'Ada',
      customer_phone: '08030000000',
      discount_amount: 0,
      id: 'order-1',
      items: [],
      order_number: 'ORD-1',
      payment_status: 'pending',
      shipping_address: null,
      shipping_status: 'pending',
      total: 10000,
      updated_at: '2024-01-01T00:00:00.000Z',
    },
    paymentAmount: '',
    paymentColor: '#ca8a04',
    paymentConfig: { label: 'Awaiting Payment' },
    paymentMethod: '',
    paymentNotes: '',
    pendingShipmentMode: 'self_fulfillment',
    proceedFromFulfillmentDetails: vi.fn(),
    proceedFromShipmentMethod: vi.fn(),
    providerBookingAvailable: false,
    providerLabel: null,
    receiptHtml: '',
    recordPaymentMutation: { isPending: false },
    requiresShipmentDetails: false,
    riderPhone: '',
    savedRiders: [],
    selectedOrderItem: null,
    setCreditNotes: vi.fn(),
    setFulfillmentDetails: vi.fn(),
    setPaymentAmount: vi.fn(),
    setPaymentMethod: vi.fn(),
    setPaymentNotes: vi.fn(),
    setPendingShipmentMode: vi.fn(),
    setRiderPhone: vi.fn(),
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
    shipOnCreditMutation: { isPending: false },
    shippingColor: '#2563eb',
    shippingConfig: { icon: 'receipt-outline', label: 'Unfulfilled' },
    showCreditModal: false,
    showPaymentOptionModal: false,
    showPostShipmentActions: false,
    showReceiptPreview: false,
    showRecordPaymentModal: false,
    showShipmentFlow: false,
    showStatusModal: false,
    sourceInfo: { color: '#2563eb', label: 'Manual', name: 'manual' },
    successModal: {
      actionLabel: '',
      actionVariant: 'default',
      message: '',
      showAction: false,
      subMessage: '',
      title: '',
      visible: false,
    },
  } as unknown as ReturnType<typeof useOrderDetailsController>;
}

describe('OrderDetailsScreenContent', () => {
  it('renders an accessible share-order action in the header', () => {
    render(<OrderDetailsScreenContent controller={createController()} />);

    expect(
      screen.getByRole('button', { name: 'Share order' })
    ).toBeInTheDocument();
  });
});
