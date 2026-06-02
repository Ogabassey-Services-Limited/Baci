// These methods receive server-sent order-received notifications, so the
// success screen suppresses duplicate local notifications for them.
export const SERVER_CONFIRMED_ORDER_NOTIFICATION_METHODS = new Set([
  'invoice',
  'payforme',
  'pay_on_delivery',
]);

export function getInitialPaymentStatus(paymentMethod: string) {
  return SERVER_CONFIRMED_ORDER_NOTIFICATION_METHODS.has(paymentMethod)
    ? 'pending'
    : 'unpaid';
}
