import type { PaymentStatus, ShippingStatus } from '@baci/shared';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import type { Order } from '@/hooks/useOrders';

export function requiresPaymentPrompt(newStatus: ShippingStatus, order: Order) {
  return (
    newStatus === 'processing' &&
    order.payment_status !== ('paid' as PaymentStatus) &&
    !order.is_credit_order
  );
}

export function showPaymentRequiredPrompt({
  order,
  onClearSelection,
}: {
  order: Order;
  onClearSelection: () => void;
}) {
  Alert.alert(
    'Payment Required',
    `This order (${order.order_number}) hasn't been paid yet. What would you like to do?`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Record Payment',
        onPress: () => {
          onClearSelection();
          router.push(`/order/${order.id}?action=record-payment`);
        },
      },
      {
        text: 'Ship on Credit',
        style: 'destructive',
        onPress: () => {
          onClearSelection();
          router.push(`/order/${order.id}?action=ship-on-credit`);
        },
      },
    ]
  );
}
