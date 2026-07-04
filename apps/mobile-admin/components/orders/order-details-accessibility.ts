interface OrderDetailsAccessibilityState {
  selectedOrderItem: unknown;
  showCreditModal: boolean;
  showPaymentOptionModal: boolean;
  showReceiptPreview: boolean;
  showRecordPaymentModal: boolean;
  showShipmentFlow: boolean;
  showStatusModal: boolean;
  successModal: {
    visible: boolean;
  };
}

export function shouldHideOrderDetailsContentFromAccessibility(
  state: OrderDetailsAccessibilityState
) {
  return Boolean(
    state.showStatusModal ||
      state.showCreditModal ||
      state.showPaymentOptionModal ||
      state.showRecordPaymentModal ||
      state.showShipmentFlow ||
      state.showReceiptPreview ||
      state.successModal.visible ||
      state.selectedOrderItem
  );
}
