import { Alert } from 'react-native';
import type { OrderDetailsRecord } from '@/components/orders/order-details.types';
import type { ShippingStatus } from '@/hooks/useOrders';
import { BASE_URL } from '@/lib/api-client';
import { supabase } from '@/lib/supabase';

interface CreateOrderDetailsStatusActionsParams {
  openShipmentFlow: () => void;
  order: OrderDetailsRecord | undefined;
  setShowCreditModal: (value: boolean) => void;
  setShowPaymentOptionModal: (value: boolean) => void;
  setShowStatusModal: (value: boolean) => void;
  setSuccessModal: (
    value:
      | {
          actionLabel: string;
          actionVariant: 'default' | 'whatsapp';
          message: string;
          showAction: boolean;
          subMessage: string;
          title: string;
          visible: boolean;
        }
      | ((previous: {
          actionLabel: string;
          actionVariant: 'default' | 'whatsapp';
          message: string;
          showAction: boolean;
          subMessage: string;
          title: string;
          visible: boolean;
        }) => {
          actionLabel: string;
          actionVariant: 'default' | 'whatsapp';
          message: string;
          showAction: boolean;
          subMessage: string;
          title: string;
          visible: boolean;
        })
  ) => void;
  updateStatus: (input: {
    orderId: string;
    status: ShippingStatus;
  }) => Promise<unknown>;
}

export function createOrderDetailsStatusActions({
  openShipmentFlow,
  order,
  setShowCreditModal,
  setShowPaymentOptionModal,
  setShowStatusModal,
  setSuccessModal,
  updateStatus,
}: CreateOrderDetailsStatusActionsParams) {
  const notifyCustomerStatusEmail = async (
    orderId: string,
    route: 'cancelled' | 'delivered',
    body?: Record<string, string>
  ) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        return;
      }

      fetch(`${BASE_URL}/api/orders/${orderId}/${route}`, {
        body: body ? JSON.stringify(body) : undefined,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        method: 'POST',
      })
        .then((response) => {
          if (__DEV__ && !response.ok) {
            console.log('UseOrder:', route, 'email failed', response.status);
          }
        })
        .catch((error) => {
          if (__DEV__) {
            console.log('UseOrder:', route, 'email fetch error', error);
          }
        });
    } catch (error) {
      if (__DEV__) {
        console.log('UseOrder: Error in', route, 'block', error);
      }
    }
  };

  const handleStatusUpdate = async (newStatus: ShippingStatus) => {
    if (!order) {
      return;
    }

    if (
      newStatus === 'processing' &&
      order.payment_status !== 'paid' &&
      !order.is_credit_order
    ) {
      setShowStatusModal(false);
      setShowPaymentOptionModal(true);
      return;
    }

    if (newStatus === 'shipped' && order.shipping_status === 'processing') {
      openShipmentFlow();
      return;
    }

    try {
      await updateStatus({ orderId: order.id, status: newStatus });
      setShowStatusModal(false);

      if (newStatus === 'delivered') {
        void notifyCustomerStatusEmail(order.id, 'delivered');
      }

      if (newStatus === 'cancelled') {
        void notifyCustomerStatusEmail(order.id, 'cancelled', {
          cancelled_by: 'merchant',
        });
      }

      const subMessage = ['shipped', 'delivered', 'cancelled'].includes(
        newStatus
      )
        ? `The customer has been notified via email that their order has been ${newStatus}.`
        : '';

      setSuccessModal({
        actionLabel: '',
        actionVariant: 'default',
        message: `Order status updated to ${newStatus}`,
        showAction: false,
        subMessage,
        title:
          newStatus === 'delivered' ? 'Order Delivered! 🎉' : 'Status Updated',
        visible: true,
      });
    } catch (error: unknown) {
      const nextError = error as Error;

      if (
        nextError.message?.includes('PAYMENT_REQUIRED') ||
        nextError.message?.includes('paid before processing')
      ) {
        Alert.alert(
          'Payment Required',
          'This order must be paid before processing. Would you like to ship on credit?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Ship on Credit', onPress: () => setShowCreditModal(true) },
          ]
        );
        return;
      }

      Alert.alert('Error', 'Failed to update status');
    }
  };

  return { handleStatusUpdate };
}
