import { PAYMENT_STATUS_CONFIG, SHIPPING_STATUS_CONFIG } from '@baci/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import {
  formatOrderDetailsDate,
  formatOrderDetailsPrice,
} from '@/components/orders/order-details.formatters';
import {
  formatOrderAddress,
  getOrderCurrencySymbol,
  getOrderSourceInfo,
  getOrderStatusColor,
} from '@/components/orders/order-details.helpers';
import { createOrderDetailsContactActions } from '@/hooks/createOrderDetailsContactActions';
import { createOrderDetailsPaymentActions } from '@/hooks/createOrderDetailsPaymentActions';
import { createOrderDetailsReceiptActions } from '@/hooks/createOrderDetailsReceiptActions';
import { createOrderDetailsShipmentActions } from '@/hooks/createOrderDetailsShipmentActions';
import { createOrderDetailsStatusActions } from '@/hooks/createOrderDetailsStatusActions';
import { useMerchant } from '@/hooks/useMerchant';
import { useOrderDetailsBackHandler } from '@/hooks/useOrderDetailsBackHandler';
import { useOrderDetailsStartupEffects } from '@/hooks/useOrderDetailsStartupEffects';
import { useOrderDetailsUiState } from '@/hooks/useOrderDetailsUiState';
import {
  type PaymentStatus,
  type ShippingStatus,
  useOrder,
  useRecordPayment,
  useSendReminder,
  useShipOnCredit,
  useUpdateOrderStatus,
} from '@/hooks/useOrders';
import { useTheme } from '@/hooks/useTheme';
import {
  canUseSelectedShippingProvider,
  formatShippingProviderName,
  orderRequiresFulfillment,
} from '@/lib/order-shipment';
import { orderDetailsRouteParamsSchema } from '@/schemas/order-details-route-params';

export function useOrderDetailsController() {
  const rawParams = useLocalSearchParams<{
    action?: string;
    id: string;
  }>();
  const { colors, shadows } = useTheme();
  const normalizedParams = {
    action: Array.isArray(rawParams.action)
      ? rawParams.action[0]
      : rawParams.action,
    id: Array.isArray(rawParams.id) ? rawParams.id[0] : rawParams.id,
  };
  const routeResult = orderDetailsRouteParamsSchema.safeParse(normalizedParams);
  const validatedParams = routeResult.success ? routeResult.data : null;
  const orderId = validatedParams?.id;
  const actionParam = validatedParams?.action;

  const queryClient = useQueryClient();
  const { data: order, error, isLoading } = useOrder(orderId ?? '');
  const { merchant } = useMerchant();
  const merchantCurrency = merchant?.payout_currency || 'NGN';
  const currencySymbol = getOrderCurrencySymbol(merchant?.payout_currency);
  const updateStatusMutation = useUpdateOrderStatus();
  const shipOnCreditMutation = useShipOnCredit();
  const sendReminderMutation = useSendReminder();
  const recordPaymentMutation = useRecordPayment();
  const uiState = useOrderDetailsUiState();

  const requiresShipmentDetails = orderRequiresFulfillment(order?.items);
  const providerLabel = formatShippingProviderName(order?.shipping_provider);
  const providerBookingAvailable = order
    ? canUseSelectedShippingProvider(order)
    : false;

  useOrderDetailsBackHandler({
    requiresShipmentDetails,
    selectedOrderItemOpen: uiState.selectedOrderItem !== null,
    setIsShipmentSubmitting: uiState.setIsShipmentSubmitting,
    setSelectedOrderItemOpen: (value) =>
      uiState.setSelectedOrderItem(value ? uiState.selectedOrderItem : null),
    setShowCreditModal: uiState.setShowCreditModal,
    setShowPaymentOptionModal: uiState.setShowPaymentOptionModal,
    setShowRecordPaymentModal: uiState.setShowRecordPaymentModal,
    setShowShipmentFlow: uiState.setShowShipmentFlow,
    setShowStatusModal: uiState.setShowStatusModal,
    setShipmentFlowStep: uiState.setShipmentFlowStep,
    shipmentFlowStep: uiState.shipmentFlowStep,
    showCreditModal: uiState.showCreditModal,
    showPaymentOptionModal: uiState.showPaymentOptionModal,
    showRecordPaymentModal: uiState.showRecordPaymentModal,
    showShipmentFlow: uiState.showShipmentFlow,
    showStatusModal: uiState.showStatusModal,
  });

  useOrderDetailsStartupEffects({
    actionParam,
    order: order ?? null,
    setPaymentAmount: uiState.setPaymentAmount,
    setSavedRiders: uiState.setSavedRiders,
    setShowCreditModal: uiState.setShowCreditModal,
    setShowRecordPaymentModal: uiState.setShowRecordPaymentModal,
  });

  const formatPrice = (amount: number) =>
    formatOrderDetailsPrice(amount, merchantCurrency);
  const formatDate = formatOrderDetailsDate;

  const contactActions = createOrderDetailsContactActions({
    formatPrice,
    merchant,
    order,
    riderPhone: uiState.riderPhone,
    savedRiders: uiState.savedRiders,
    setSavedRiders: uiState.setSavedRiders,
  });

  const paymentActions = createOrderDetailsPaymentActions({
    creditNotes: uiState.creditNotes,
    formatPrice,
    order,
    paymentAmount: uiState.paymentAmount,
    paymentMethod: uiState.paymentMethod,
    paymentNotes: uiState.paymentNotes,
    recordPayment: recordPaymentMutation.mutateAsync,
    sendReminder: sendReminderMutation.mutateAsync,
    setCreditNotes: uiState.setCreditNotes,
    setPaymentAmount: uiState.setPaymentAmount,
    setPaymentMethod: uiState.setPaymentMethod,
    setPaymentNotes: uiState.setPaymentNotes,
    setShowCreditModal: uiState.setShowCreditModal,
    setShowRecordPaymentModal: uiState.setShowRecordPaymentModal,
    shipOnCredit: shipOnCreditMutation.mutateAsync,
  });

  const shipmentActions = createOrderDetailsShipmentActions({
    fulfillmentDetails: uiState.fulfillmentDetails,
    handleSaveRider: contactActions.handleSaveRider,
    merchantId: merchant?.id,
    order,
    pendingShipmentMode: uiState.pendingShipmentMode,
    providerBookingAvailable,
    providerLabel,
    queryClient,
    requiresShipmentDetails,
    riderPhone: uiState.riderPhone,
    setFulfillmentDetails: uiState.setFulfillmentDetails,
    setIsShipmentSubmitting: uiState.setIsShipmentSubmitting,
    setPendingShipmentMode: uiState.setPendingShipmentMode,
    setRiderPhone: uiState.setRiderPhone,
    setShipmentFlowStep: uiState.setShipmentFlowStep,
    setShowShipmentFlow: uiState.setShowShipmentFlow,
    setShowStatusModal: uiState.setShowStatusModal,
    setSuccessModal: uiState.setSuccessModal,
    shipmentFlowStep: uiState.shipmentFlowStep,
    showShipmentFlow: uiState.showShipmentFlow,
    updateStatus: updateStatusMutation.mutateAsync,
  });

  const statusActions = createOrderDetailsStatusActions({
    openShipmentFlow: shipmentActions.openShipmentFlow,
    order,
    setShowCreditModal: uiState.setShowCreditModal,
    setShowPaymentOptionModal: uiState.setShowPaymentOptionModal,
    setShowStatusModal: uiState.setShowStatusModal,
    setSuccessModal: uiState.setSuccessModal,
    updateStatus: updateStatusMutation.mutateAsync,
  });

  const receiptActions = createOrderDetailsReceiptActions({
    isGeneratingReceipt: uiState.isGeneratingReceipt,
    merchant,
    order,
    receiptHtml: uiState.receiptHtml,
    setIsGeneratingReceipt: uiState.setIsGeneratingReceipt,
    setReceiptHtml: uiState.setReceiptHtml,
    setShowReceiptPreview: uiState.setShowReceiptPreview,
  });

  const shippingConfig = order?.shipping_status
    ? SHIPPING_STATUS_CONFIG[order.shipping_status as ShippingStatus] ||
      SHIPPING_STATUS_CONFIG.pending
    : SHIPPING_STATUS_CONFIG.pending;
  const paymentConfig = order?.payment_status
    ? PAYMENT_STATUS_CONFIG[order.payment_status as PaymentStatus] ||
      PAYMENT_STATUS_CONFIG.pending
    : PAYMENT_STATUS_CONFIG.pending;
  const shippingColor = getOrderStatusColor(colors, shippingConfig.colorKey);
  const paymentColor = getOrderStatusColor(colors, paymentConfig.colorKey);
  const sourceInfo = getOrderSourceInfo(colors, order?.source);
  const showPostShipmentActions = Boolean(
    order?.shipping_status === 'shipped' &&
      order.self_fulfillment_data?.dispatchPhone?.trim()
  );
  const hasCustomerPhone = Boolean(order?.customer_phone?.trim());
  const isInvalidRoute = !validatedParams;

  return {
    actionParam,
    closeShipmentFlow: shipmentActions.closeShipmentFlow,
    colors,
    creditNotes: uiState.creditNotes,
    currencySymbol,
    error,
    formatAddress: formatOrderAddress,
    formatDate,
    formatPrice,
    fulfillmentDetails: uiState.fulfillmentDetails,
    handleCall: contactActions.handleCall,
    handleEmail: contactActions.handleEmail,
    handlePaymentAmountChange: paymentActions.handlePaymentAmountChange,
    handleRecordPayment: paymentActions.handleRecordPayment,
    handleSendOrderDetailsToRider: contactActions.handleSendOrderDetailsToRider,
    handleSendReceipt: receiptActions.handleSendReceipt,
    handleSendReminder: paymentActions.handleSendReminder,
    handleSendRiderToCustomer: contactActions.handleSendRiderToCustomer,
    handleShare: contactActions.handleShare,
    handleShareReceiptPdf: receiptActions.handleShareReceiptPdf,
    handleShipOnCredit: paymentActions.handleShipOnCredit,
    handleShipmentFlowBack: shipmentActions.handleShipmentFlowBack,
    handleStatusUpdate: statusActions.handleStatusUpdate,
    handleSubmitSelfFulfillment: shipmentActions.handleSubmitSelfFulfillment,
    handleWhatsApp: contactActions.handleWhatsApp,
    hasCustomerPhone,
    isGeneratingReceipt: uiState.isGeneratingReceipt,
    isInvalidRoute,
    isLoading,
    isShipmentSubmitting: uiState.isShipmentSubmitting,
    merchant,
    order,
    orderId,
    paymentAmount: uiState.paymentAmount,
    paymentColor,
    paymentConfig,
    paymentMethod: uiState.paymentMethod,
    paymentNotes: uiState.paymentNotes,
    paymentStatusConfig: paymentConfig,
    pendingShipmentMode: uiState.pendingShipmentMode,
    proceedFromFulfillmentDetails:
      shipmentActions.proceedFromFulfillmentDetails,
    proceedFromShipmentMethod: shipmentActions.proceedFromShipmentMethod,
    providerBookingAvailable,
    providerLabel,
    queryClient,
    receiptHtml: uiState.receiptHtml,
    recordPaymentMutation,
    requiresShipmentDetails,
    riderPhone: uiState.riderPhone,
    savedRiders: uiState.savedRiders,
    selectedOrderItem: uiState.selectedOrderItem,
    sendReminderMutation,
    setCreditNotes: uiState.setCreditNotes,
    setFulfillmentDetails: uiState.setFulfillmentDetails,
    setPaymentAmount: uiState.setPaymentAmount,
    setPaymentMethod: uiState.setPaymentMethod,
    setPaymentNotes: uiState.setPaymentNotes,
    setPendingShipmentMode: uiState.setPendingShipmentMode,
    setRiderPhone: uiState.setRiderPhone,
    setSelectedOrderItem: uiState.setSelectedOrderItem,
    setShipmentFlowStep: uiState.setShipmentFlowStep,
    setShowCreditModal: uiState.setShowCreditModal,
    setShowPaymentOptionModal: uiState.setShowPaymentOptionModal,
    setShowReceiptPreview: uiState.setShowReceiptPreview,
    setShowRecordPaymentModal: uiState.setShowRecordPaymentModal,
    setShowShipmentFlow: uiState.setShowShipmentFlow,
    setShowStatusModal: uiState.setShowStatusModal,
    setSuccessModal: uiState.setSuccessModal,
    shadows,
    shipOnCreditMutation,
    shipmentFlowStep: uiState.shipmentFlowStep,
    shippingColor,
    shippingConfig,
    showCreditModal: uiState.showCreditModal,
    showPaymentOptionModal: uiState.showPaymentOptionModal,
    showPostShipmentActions,
    showReceiptPreview: uiState.showReceiptPreview,
    showRecordPaymentModal: uiState.showRecordPaymentModal,
    showShipmentFlow: uiState.showShipmentFlow,
    showStatusModal: uiState.showStatusModal,
    sourceInfo,
    successModal: uiState.successModal,
    updateStatusMutation,
  };
}
