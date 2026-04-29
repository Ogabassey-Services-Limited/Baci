import { router } from 'expo-router';
import type { MutableRefObject } from 'react';
import { PAYMENT_CLIPBOARD_BRIDGE } from '@/constants/payment-clipboard-bridge';
import { isPlainRecord } from './payment-gateway.helpers';

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
  scheduleDelayedNavigation: (navigate: () => void) => void;
  setSuccessStatus: () => void;
}

function handleClipboardText({
  copiedGatewayTextRef,
  copyGatewayText,
  failureMessage,
  successMessage,
  text,
}: {
  copiedGatewayTextRef: MutableRefObject<string | null>;
  copyGatewayText: (
    text: string,
    successMessage: string,
    failureMessage?: string
  ) => Promise<void>;
  failureMessage?: string;
  successMessage: string;
  text: unknown;
}) {
  const copiedText = getTrimmedString(text);
  if (!copiedText || copiedGatewayTextRef.current === copiedText) {
    return;
  }

  copiedGatewayTextRef.current = copiedText;
  if (failureMessage) {
    void copyGatewayText(copiedText, successMessage, failureMessage);
    return;
  }
  void copyGatewayText(copiedText, successMessage);
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
  scheduleDelayedNavigation,
  setSuccessStatus,
}: CreatePaymentGatewayMessageHandlerInput) {
  return (event: { nativeEvent: { data: string } }) => {
    let data: unknown;
    try {
      data = JSON.parse(event.nativeEvent.data);
    } catch (error) {
      if (error instanceof SyntaxError) {
        return;
      }
      throw error;
    }

    if (!isPlainRecord(data)) {
      return;
    }

    if (data.type === PAYMENT_CLIPBOARD_BRIDGE.clipboardMessageType) {
      handleClipboardText({
        copiedGatewayTextRef,
        copyGatewayText,
        successMessage: 'Text copied.',
        text: data.text,
      });
      return;
    }

    if (data.type === PAYMENT_CLIPBOARD_BRIDGE.accountNumberMessageType) {
      handleClipboardText({
        copiedGatewayTextRef,
        copyGatewayText,
        failureMessage: 'Unable to copy account number.',
        successMessage: 'Account number copied.',
        text: data.text,
      });
      return;
    }

    if (data.type === 'crypto_success') {
      const cryptoOrderId =
        getTrimmedString(data.orderId) || getTrimmedString(orderId);
      markPaymentCompletionStarted();
      setSuccessStatus();
      clearCart();
      scheduleDelayedNavigation(() => {
        router.replace({
          pathname: '/order-success',
          params: {
            orderId: cryptoOrderId,
            orderNumber: getTrimmedString(orderNumber),
            paymentMethod: getTrimmedString(gateway) || 'crypto',
            reference: getTrimmedString(reference),
          },
        });
      });
      return;
    }
  };
}
