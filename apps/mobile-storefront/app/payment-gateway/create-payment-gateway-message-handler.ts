import { router } from 'expo-router';
import type { MutableRefObject } from 'react';
import { PAYMENT_CLIPBOARD_BRIDGE } from '@/constants/payment-clipboard-bridge';
import { isPaymentGatewayRecord } from './payment-gateway.helpers';

const PAYMENT_SUCCESS_NAV_DELAY = 1500;

const getTrimmedString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

interface CreatePaymentGatewayMessageHandlerInput {
  clearCart: () => void;
  copiedGatewayTextRef: MutableRefObject<string | null>;
  copyGatewayText: (
    text: string,
    successMessage: string,
    failureMessage?: string
  ) => Promise<void>;
  gateway?: string;
  orderId?: string;
  orderNumber?: string;
  reference?: string;
  markPaymentCompletionStarted: () => void;
  setSuccessStatus: () => void;
}

export function createPaymentGatewayMessageHandler({
  clearCart,
  copiedGatewayTextRef,
  copyGatewayText,
  gateway,
  orderId,
  orderNumber,
  reference,
  markPaymentCompletionStarted,
  setSuccessStatus,
}: CreatePaymentGatewayMessageHandlerInput) {
  return (event: { nativeEvent: { data: string } }) => {
    try {
      const data: unknown = JSON.parse(event.nativeEvent.data);
      if (!isPaymentGatewayRecord(data)) {
        return;
      }

      if (data.type === PAYMENT_CLIPBOARD_BRIDGE.clipboardMessageType) {
        const copiedText = getTrimmedString(data.text);
        if (copiedText && copiedGatewayTextRef.current !== copiedText) {
          copiedGatewayTextRef.current = copiedText;
          void copyGatewayText(copiedText, 'Text copied.');
        }
        return;
      }

      if (data.type === PAYMENT_CLIPBOARD_BRIDGE.accountNumberMessageType) {
        const accountNumber = getTrimmedString(data.text);
        if (accountNumber && copiedGatewayTextRef.current !== accountNumber) {
          copiedGatewayTextRef.current = accountNumber;
          void copyGatewayText(
            accountNumber,
            'Account number copied.',
            'Unable to copy account number.'
          );
        }
        return;
      }

      if (data.type === 'crypto_success') {
        const cryptoOrderId =
          getTrimmedString(data.orderId) || getTrimmedString(orderId);
        markPaymentCompletionStarted();
        setSuccessStatus();
        clearCart();
        setTimeout(() => {
          router.replace({
            pathname: '/order-success',
            params: {
              orderId: cryptoOrderId,
              orderNumber: getTrimmedString(orderNumber),
              paymentMethod: getTrimmedString(gateway) || 'crypto',
              reference: getTrimmedString(reference),
            },
          });
        }, PAYMENT_SUCCESS_NAV_DELAY);
      }
    } catch {
      // Ignore non-JSON messages from gateway pages.
    }
  };
}
