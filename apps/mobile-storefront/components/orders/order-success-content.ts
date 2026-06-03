const FALLBACK_DELIVERY_ESTIMATE = 'Shared after order confirmation';

export function getOrderSuccessTone(paymentMethod?: string) {
  if (paymentMethod === 'invoice') {
    return {
      documentLabel: 'View / Download Invoice',
      eyebrow: 'Invoice ready',
      nextDocumentText:
        'Your branded invoice is ready now. You can view it and share it as a PDF.',
      nextDocumentTitle: 'Invoice',
      subtitle:
        "We've prepared your invoice. Once payment is made, we'll confirm the order and start processing it.",
      title: 'Invoice Created',
    };
  }

  if (paymentMethod === 'payforme') {
    return {
      documentLabel: 'View / Download Invoice',
      eyebrow: 'Payment request ready',
      nextDocumentText:
        'The invoice remains available while this payment request is pending.',
      nextDocumentTitle: 'Invoice',
      subtitle:
        "We've saved this order for later payment. Once it is settled, we'll confirm it and begin processing.",
      title: 'Payment Request Created',
    };
  }

  return {
    documentLabel: 'View Receipt',
    eyebrow: 'Order confirmed',
    nextDocumentText:
      'Your receipt is ready to preview and share once the order record is available.',
    nextDocumentTitle: 'Receipt',
    subtitle:
      "Thanks for your order. We'll send a confirmation email and keep you updated as it moves.",
    title: 'Order Confirmed',
  };
}

export function resolveOrderSuccessDeliveryEstimate(value?: string) {
  return value?.trim() || FALLBACK_DELIVERY_ESTIMATE;
}

export function getOrderSuccessDeliveryLabel(value?: string) {
  return value?.trim() ? 'Estimated Delivery' : 'Delivery Timeline';
}
