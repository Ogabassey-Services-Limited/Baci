import { useState } from 'react';
import type { ShipmentCompletionMode, ShipmentFlowStep } from '@/lib/order-shipment';
import type { OrderItemSnapshot } from '@/components/orders/OrderItemDetailModal';

export interface OrderDetailsSuccessModalState {
  actionLabel: string;
  actionVariant: 'default' | 'whatsapp';
  message: string;
  showAction: boolean;
  subMessage: string;
  title: string;
  visible: boolean;
}

export function useOrderDetailsUiState() {
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showShipmentFlow, setShowShipmentFlow] = useState(false);
  const [shipmentFlowStep, setShipmentFlowStep] =
    useState<ShipmentFlowStep>('details');
  const [isShipmentSubmitting, setIsShipmentSubmitting] = useState(false);
  const [creditNotes, setCreditNotes] = useState('');
  const [fulfillmentDetails, setFulfillmentDetails] = useState({
    imei: '',
    serialNumber: '',
  });
  const [riderPhone, setRiderPhone] = useState('');
  const [savedRiders, setSavedRiders] = useState<string[]>([]);
  const [showPaymentOptionModal, setShowPaymentOptionModal] = useState(false);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [receiptHtml, setReceiptHtml] = useState('');
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);
  const [selectedOrderItem, setSelectedOrderItem] =
    useState<OrderItemSnapshot | null>(null);
  const [pendingShipmentMode, setPendingShipmentMode] =
    useState<ShipmentCompletionMode>('provider');
  const [successModal, setSuccessModal] =
    useState<OrderDetailsSuccessModalState>({
    visible: false,
    title: 'Success!',
    message: '',
    subMessage: '',
    actionLabel: '',
    actionVariant: 'default',
    showAction: false,
  });

  return {
    creditNotes,
    fulfillmentDetails,
    isGeneratingReceipt,
    isShipmentSubmitting,
    paymentAmount,
    paymentMethod,
    paymentNotes,
    pendingShipmentMode,
    receiptHtml,
    riderPhone,
    savedRiders,
    selectedOrderItem,
    setCreditNotes,
    setFulfillmentDetails,
    setIsGeneratingReceipt,
    setIsShipmentSubmitting,
    setPaymentAmount,
    setPaymentMethod,
    setPaymentNotes,
    setPendingShipmentMode,
    setReceiptHtml,
    setRiderPhone,
    setSavedRiders,
    setSelectedOrderItem,
    setShowCreditModal,
    setShowPaymentOptionModal,
    setShowReceiptPreview,
    setShowRecordPaymentModal,
    setShowShipmentFlow,
    setShowStatusModal,
    setShipmentFlowStep,
    setSuccessModal,
    shipmentFlowStep,
    showCreditModal,
    showPaymentOptionModal,
    showReceiptPreview,
    showRecordPaymentModal,
    showShipmentFlow,
    showStatusModal,
    successModal,
  };
}
