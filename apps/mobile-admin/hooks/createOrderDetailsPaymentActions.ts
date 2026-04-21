import { Alert } from 'react-native';
import { parseOrderDetailsCurrencyInput } from '@/components/orders/order-details.formatters';
import type { OrderDetailsRecord } from '@/components/orders/order-details.types';

interface CreateOrderDetailsPaymentActionsParams {
  creditNotes: string;
  formatPrice: (amount: number) => string;
  order: OrderDetailsRecord | undefined;
  paymentAmount: string;
  paymentMethod: string;
  paymentNotes: string;
  recordPayment: (input: {
    amount: number;
    notes: string;
    orderId: string;
    paymentMethod: string;
  }) => Promise<{ new_balance: number }>;
  sendReminder: (input: { orderId: string }) => Promise<unknown>;
  setCreditNotes: (value: string) => void;
  setPaymentAmount: (value: string) => void;
  setPaymentMethod: (value: string) => void;
  setPaymentNotes: (value: string) => void;
  setShowCreditModal: (value: boolean) => void;
  setShowRecordPaymentModal: (value: boolean) => void;
  shipOnCredit: (input: {
    creditNotes: string;
    orderId: string;
  }) => Promise<unknown>;
}

export function createOrderDetailsPaymentActions({
  creditNotes,
  formatPrice,
  order,
  paymentAmount,
  paymentMethod,
  paymentNotes,
  recordPayment,
  sendReminder,
  setCreditNotes,
  setPaymentAmount,
  setPaymentMethod,
  setPaymentNotes,
  setShowCreditModal,
  setShowRecordPaymentModal,
  shipOnCredit,
}: CreateOrderDetailsPaymentActionsParams) {
  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    if (typeof error === 'string' && error) {
      return error;
    }
    return fallback;
  };

  const handlePaymentAmountChange = (text: string) => {
    setPaymentAmount(parseOrderDetailsCurrencyInput(text));
  };

  let isRecordingPayment = false;

  const handleRecordPayment = async () => {
    if (isRecordingPayment) {
      return;
    }
    if (!order) {
      Alert.alert('Error', 'Order details are not available yet');
      return;
    }
    if (
      !paymentAmount ||
      Number.isNaN(Number(paymentAmount)) ||
      Number(paymentAmount) <= 0
    ) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (!paymentMethod) {
      Alert.alert('Error', 'Please select a payment method');
      return;
    }

    isRecordingPayment = true;
    try {
      const result = await recordPayment({
        amount: Number(paymentAmount),
        notes: paymentNotes,
        orderId: order.id,
        paymentMethod,
      });

      setShowRecordPaymentModal(false);
      setPaymentAmount('');
      setPaymentMethod('');
      setPaymentNotes('');

      if (result.new_balance > 0) {
        Alert.alert(
          'Payment Recorded',
          `Remaining Balance: ${formatPrice(result.new_balance)}. Ship remaining on credit?`,
          [
            { text: 'No', style: 'cancel' },
            {
              text: 'Yes, Ship on Credit',
              onPress: () => setShowCreditModal(true),
            },
          ]
        );
        return;
      }

      Alert.alert('Success', 'Payment recorded. Order is now fully paid.');
    } catch (error: unknown) {
      Alert.alert('Error', getErrorMessage(error, 'Failed to record payment'));
    } finally {
      isRecordingPayment = false;
    }
  };

  const handleShipOnCredit = async () => {
    if (!order) {
      Alert.alert('Error', 'Order details are not available yet');
      return;
    }

    try {
      await shipOnCredit({
        creditNotes,
        orderId: order.id,
      });
      setShowCreditModal(false);
      setCreditNotes('');
      Alert.alert(
        'Success',
        'Order shipped on credit. A virtual account has been created for payment.'
      );
    } catch (error: unknown) {
      Alert.alert('Error', getErrorMessage(error, 'Failed to ship on credit'));
    }
  };

  const handleSendReminder = async () => {
    if (!order) {
      Alert.alert('Error', 'Order details are not available yet');
      return;
    }

    try {
      await sendReminder({ orderId: order.id });
      Alert.alert(
        'Reminder Sent',
        `Payment reminder sent to ${order.customer_email}`
      );
    } catch (error: unknown) {
      Alert.alert('Error', getErrorMessage(error, 'Failed to send reminder'));
    }
  };

  return {
    handlePaymentAmountChange,
    handleRecordPayment,
    handleSendReminder,
    handleShipOnCredit,
  };
}
