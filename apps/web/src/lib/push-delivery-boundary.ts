type DeliveryStartCallback = () => void | Promise<void>;

export function createDeliveryStartBoundary(
  onDeliveryStart?: DeliveryStartCallback
) {
  let deliveryStarted = false;

  return async function markDeliveryStarted(): Promise<void> {
    if (deliveryStarted) return;
    await onDeliveryStart?.();
    deliveryStarted = true;
  };
}
