import { Alert } from 'react-native';
import type { QueryClient } from '@tanstack/react-query';
import {
  getDispatchPhoneFromOrder,
  getInitialFulfillmentDetails,
  shouldPersistFulfillmentDetails,
  type ShipmentCompletionMode,
  type ShipmentFlowStep,
} from '@/lib/order-shipment';
import type { OrderDetailsRecord } from '@/components/orders/order-details.types';
import { completeOrderShipment } from './completeOrderShipment';

interface FulfillmentDetails {
  imei: string;
  serialNumber: string;
}

interface SuccessModalState {
  actionLabel: string;
  actionVariant: 'default' | 'whatsapp';
  message: string;
  showAction: boolean;
  subMessage: string;
  title: string;
  visible: boolean;
}

interface CreateOrderDetailsShipmentActionsParams {
  fulfillmentDetails: FulfillmentDetails;
  handleSaveRider: (phone: string) => Promise<void>;
  order: OrderDetailsRecord | undefined;
  pendingShipmentMode: ShipmentCompletionMode;
  providerBookingAvailable: boolean;
  providerLabel: string | null;
  queryClient: QueryClient;
  requiresShipmentDetails: boolean;
  riderPhone: string;
  setFulfillmentDetails: (value: FulfillmentDetails) => void;
  setIsShipmentSubmitting: (value: boolean) => void;
  setPendingShipmentMode: (value: ShipmentCompletionMode) => void;
  setRiderPhone: (value: string) => void;
  setShipmentFlowStep: (value: ShipmentFlowStep) => void;
  setShowShipmentFlow: (value: boolean) => void;
  setShowStatusModal: (value: boolean) => void;
  setSuccessModal: (value: SuccessModalState) => void;
  shipmentFlowStep: ShipmentFlowStep;
  showShipmentFlow: boolean;
  updateStatus: (input: { orderId: string; status: 'shipped' }) => Promise<unknown>;
}

export function createOrderDetailsShipmentActions({
  fulfillmentDetails,
  handleSaveRider,
  order,
  pendingShipmentMode,
  providerBookingAvailable,
  providerLabel,
  queryClient,
  requiresShipmentDetails,
  riderPhone,
  setFulfillmentDetails,
  setIsShipmentSubmitting,
  setPendingShipmentMode,
  setRiderPhone,
  setShipmentFlowStep,
  setShowShipmentFlow,
  setShowStatusModal,
  setSuccessModal,
  shipmentFlowStep,
  showShipmentFlow,
  updateStatus,
}: CreateOrderDetailsShipmentActionsParams) {
  const closeShipmentFlow = () => {
    setShowShipmentFlow(false);
    setShipmentFlowStep('details');
    setPendingShipmentMode(
      providerBookingAvailable ? 'provider' : 'self_fulfillment'
    );
    setIsShipmentSubmitting(false);
  };

  const handleShipmentFlowBack = () => {
    if (!showShipmentFlow) {
      return;
    }
    if (shipmentFlowStep === 'rider') {
      setShipmentFlowStep('method');
      return;
    }
    if (shipmentFlowStep === 'method' && requiresShipmentDetails) {
      setShipmentFlowStep('details');
      return;
    }
    closeShipmentFlow();
  };

  const openShipmentFlow = () => {
    if (!order) {
      return;
    }

    setShowStatusModal(false);
    setFulfillmentDetails(getInitialFulfillmentDetails(order.fulfillment_details));
    setRiderPhone(getDispatchPhoneFromOrder(order) || '');
    setPendingShipmentMode(
      providerBookingAvailable ? 'provider' : 'self_fulfillment'
    );
    setShipmentFlowStep(requiresShipmentDetails ? 'details' : 'method');
    setShowShipmentFlow(true);
  };

  const finalizeShipmentCompletion = async (mode: ShipmentCompletionMode) => {
    if (!order) {
      return;
    }

    setIsShipmentSubmitting(true);

    try {
      const modalState = await completeOrderShipment({
        fulfillmentDetails,
        handleSaveRider,
        mode,
        order,
        providerBookingAvailable,
        providerLabel: providerLabel || '',
        queryClient,
        riderPhone,
        saveDetails: shouldPersistFulfillmentDetails(fulfillmentDetails),
        updateStatus,
      });

      closeShipmentFlow();
      setFulfillmentDetails({ imei: '', serialNumber: '' });
      setSuccessModal({ ...modalState, visible: true });
    } finally {
      setIsShipmentSubmitting(false);
    }
  };

  const proceedFromFulfillmentDetails = () => {
    if (
      requiresShipmentDetails &&
      !shouldPersistFulfillmentDetails(fulfillmentDetails)
    ) {
      Alert.alert('Required', 'Please enter the IMEI or serial number');
      return;
    }

    setShipmentFlowStep('method');
  };

  const proceedFromShipmentMethod = async () => {
    if (pendingShipmentMode === 'self_fulfillment') {
      setShipmentFlowStep('rider');
      return;
    }

    try {
      await finalizeShipmentCompletion('provider');
    } catch (error: unknown) {
      Alert.alert(
        'Error',
        (error as Error).message || 'Failed to mark order as shipped'
      );
    }
  };

  const handleSubmitSelfFulfillment = async () => {
    try {
      await finalizeShipmentCompletion('self_fulfillment');
    } catch (error: unknown) {
      Alert.alert(
        'Error',
        (error as Error).message || 'Failed to save fulfillment details'
      );
    }
  };

  return {
    closeShipmentFlow,
    handleShipmentFlowBack,
    handleSubmitSelfFulfillment,
    openShipmentFlow,
    proceedFromFulfillmentDetails,
    proceedFromShipmentMethod,
  };
}
