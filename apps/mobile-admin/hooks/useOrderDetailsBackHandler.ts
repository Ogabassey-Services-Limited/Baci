import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { isRuntimePlatform } from '@/config/runtime-platform';
import type { ShipmentFlowStep } from '@/lib/order-shipment';

export function useOrderDetailsBackHandler({
  requiresShipmentDetails,
  selectedOrderItemOpen,
  setIsShipmentSubmitting,
  setSelectedOrderItemOpen,
  setShowCreditModal,
  setShowPaymentOptionModal,
  setShowRecordPaymentModal,
  setShowShipmentFlow,
  setShowStatusModal,
  setShipmentFlowStep,
  showCreditModal,
  showPaymentOptionModal,
  showRecordPaymentModal,
  showShipmentFlow,
  showStatusModal,
  shipmentFlowStep,
}: {
  requiresShipmentDetails: boolean;
  selectedOrderItemOpen: boolean;
  setIsShipmentSubmitting: (value: boolean) => void;
  setSelectedOrderItemOpen: (value: boolean) => void;
  setShowCreditModal: (value: boolean) => void;
  setShowPaymentOptionModal: (value: boolean) => void;
  setShowRecordPaymentModal: (value: boolean) => void;
  setShowShipmentFlow: (value: boolean) => void;
  setShowStatusModal: (value: boolean) => void;
  setShipmentFlowStep: (value: ShipmentFlowStep) => void;
  showCreditModal: boolean;
  showPaymentOptionModal: boolean;
  showRecordPaymentModal: boolean;
  showShipmentFlow: boolean;
  showStatusModal: boolean;
  shipmentFlowStep: ShipmentFlowStep;
}) {
  useEffect(() => {
    if (!isRuntimePlatform('android')) return;

    const anyModalOpen =
      showStatusModal ||
      showCreditModal ||
      showShipmentFlow ||
      showPaymentOptionModal ||
      showRecordPaymentModal ||
      selectedOrderItemOpen;
    if (!anyModalOpen) return;

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (showRecordPaymentModal) {
          setShowRecordPaymentModal(false);
          return true;
        }
        if (selectedOrderItemOpen) {
          setSelectedOrderItemOpen(false);
          return true;
        }
        if (showPaymentOptionModal) {
          setShowPaymentOptionModal(false);
          return true;
        }
        if (showShipmentFlow) {
          if (shipmentFlowStep === 'rider') {
            setShipmentFlowStep('method');
            return true;
          }
          if (shipmentFlowStep === 'method' && requiresShipmentDetails) {
            setShipmentFlowStep('details');
            return true;
          }
          setShowShipmentFlow(false);
          setShipmentFlowStep('details');
          setIsShipmentSubmitting(false);
          return true;
        }
        if (showCreditModal) {
          setShowCreditModal(false);
          return true;
        }
        if (showStatusModal) {
          setShowStatusModal(false);
          return true;
        }
        return false;
      }
    );

    return () => backHandler.remove();
  }, [
    requiresShipmentDetails,
    selectedOrderItemOpen,
    setIsShipmentSubmitting,
    setSelectedOrderItemOpen,
    setShowCreditModal,
    setShowPaymentOptionModal,
    setShowRecordPaymentModal,
    setShowShipmentFlow,
    setShowStatusModal,
    setShipmentFlowStep,
    shipmentFlowStep,
    showCreditModal,
    showPaymentOptionModal,
    showRecordPaymentModal,
    showShipmentFlow,
    showStatusModal,
  ]);
}
