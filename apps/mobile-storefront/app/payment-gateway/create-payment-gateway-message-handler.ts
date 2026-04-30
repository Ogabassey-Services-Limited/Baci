import { router } from 'expo-router';
import type { MutableRefObject } from 'react';
import { PAYMENT_CLIPBOARD_BRIDGE } from '@/constants/payment-clipboard-bridge';
import {
  isPlainRecord,
  PAYMENT_KINDS,
  type PaymentKind,
} from './payment-gateway.helpers';

const getTrimmedString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

interface CreatePaymentGatewayMessageHandlerInput {
  amount?: number;
  clearCart: () => void;
  copiedGatewayTextRef: MutableRefObject<string | null>;
  copyGatewayText: (
    text: string,
    successMessage: string,
    failureMessage?: string
  ) => Promise<void>;
  gateway?: string;
  customerIdentifier?: string;
  orderId?: string;
  orderNumber?: string;
  paymentKind?: PaymentKind;
  reference?: string;
  utilityType?: string;
  markPaymentCompletionStarted: () => void;
  scheduleDelayedNavigation: (navigate: () => void) => void;
  setSuccessStatus: () => void;
}

const getFiniteNumber = (value: unknown) => {
  const trimmedValue = typeof value === 'string' ? value.trim() : '';
  const numberValue =
    typeof value === 'number'
      ? value
      : trimmedValue
        ? Number(trimmedValue)
        : Number.NaN;
  return Number.isFinite(numberValue) ? numberValue : undefined;
};

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
  void copyGatewayText(copiedText, successMessage, failureMessage);
}

export function createPaymentGatewayMessageHandler({
  amount,
  clearCart,
  copiedGatewayTextRef,
  copyGatewayText,
  customerIdentifier,
  gateway,
  orderId,
  orderNumber,
  paymentKind,
  reference,
  utilityType,
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
      const cryptoReference =
        getTrimmedString(data.reference) || getTrimmedString(reference);

      if (paymentKind === PAYMENT_KINDS.VTU) {
        const cryptoAmount = getFiniteNumber(data.amount) ?? amount ?? 0;
        const cryptoCustomerIdentifier =
          getTrimmedString(data.customerIdentifier) ||
          getTrimmedString(customerIdentifier);
        if (!utilityType || !cryptoReference || cryptoAmount <= 0) {
          console.error('Unable to route VTU crypto payment success:', {
            amount: cryptoAmount,
            hasReference: Boolean(cryptoReference),
            hasUtilityType: Boolean(utilityType),
          });
          return;
        }

        markPaymentCompletionStarted();
        setSuccessStatus();
        scheduleDelayedNavigation(() => {
          router.replace({
            pathname: '/utilities/[type]',
            params: {
              amount: String(cryptoAmount),
              paymentStatus: 'successful',
              reference: cryptoReference,
              type: utilityType,
              ...(cryptoCustomerIdentifier && {
                customerIdentifier: cryptoCustomerIdentifier,
              }),
            },
          });
        });
        return;
      }

      if (!cryptoOrderId || !cryptoReference) {
        console.error('Unable to route crypto payment success:', {
          hasOrderId: Boolean(cryptoOrderId),
          hasReference: Boolean(cryptoReference),
        });
        return;
      }

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
            reference: cryptoReference,
          },
        });
      });
      return;
    }
  };
}
