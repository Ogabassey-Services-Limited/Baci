import { router } from 'expo-router';
import type { RefObject } from 'react';
import {
  VtuPaymentStillProcessingError,
  waitForVtuConfirmation,
} from '@/lib/vtu-checkout';
import type { PaymentGatewayParams } from '@/schemas/payment-gateway';

type CheckoutGateway = PaymentGatewayParams['gateway'];
const JUICYWAY_GATEWAY = 'juicyway' as const;

interface VtuPaymentCompletionResult {
  resultAmount?: number;
  resultCashback?: {
    amount: number;
    newBalance: number;
  };
  resultCustomerIdentifier?: string;
  resultReference: string;
  resultStatus: 'processing' | 'successful';
  resultVoucherPin?: string;
}

interface RouteToUtilityResultInput extends VtuPaymentCompletionResult {
  amount: number | undefined;
  customerIdentifier: string | undefined;
  isMountedRef: RefObject<boolean>;
  utilityType: string;
}

export function routeToUtilityResult({
  amount,
  customerIdentifier,
  isMountedRef,
  resultAmount,
  resultCashback,
  resultCustomerIdentifier,
  resultReference,
  resultStatus,
  resultVoucherPin,
  utilityType,
}: RouteToUtilityResultInput) {
  if (!isMountedRef.current) {
    return;
  }

  router.replace({
    pathname: '/utilities/[type]',
    params: {
      amount: String(resultAmount ?? amount ?? 0),
      paymentStatus: resultStatus,
      reference: resultReference,
      type: utilityType,
      ...((resultCustomerIdentifier || customerIdentifier) && {
        customerIdentifier: resultCustomerIdentifier || customerIdentifier,
      }),
      ...(resultCashback && {
        cashbackAmount: String(resultCashback.amount),
        cashbackNewBalance: String(resultCashback.newBalance),
      }),
      ...(resultVoucherPin && { voucherPin: resultVoucherPin }),
    },
  });
}

interface HandleVtuConfirmationInput {
  amount: number | undefined;
  customerIdentifier: string | undefined;
  fallbackAmount?: number;
  fallbackCustomerIdentifier?: string;
  gateway: CheckoutGateway | undefined;
  isMountedRef: RefObject<boolean>;
  isCurrentVtuConfirmation: (token: number) => boolean;
  nextReference?: string;
  scheduleDelayedNavigation: (navigate: () => void) => void;
  setErrorMessage: (message: string | null) => void;
  setStatus: (
    status: 'loading' | 'ready' | 'processing' | 'success' | 'error'
  ) => void;
  utilityType: string | undefined;
  vtuConfirmationTokenRef: RefObject<number>;
}

export async function handleVtuConfirmation({
  amount,
  customerIdentifier,
  fallbackAmount,
  fallbackCustomerIdentifier,
  gateway,
  isMountedRef,
  isCurrentVtuConfirmation,
  nextReference,
  scheduleDelayedNavigation,
  setErrorMessage,
  setStatus,
  utilityType,
  vtuConfirmationTokenRef,
}: HandleVtuConfirmationInput) {
  const confirmationToken = vtuConfirmationTokenRef.current;

  if (!utilityType || !gateway) {
    if (!isCurrentVtuConfirmation(confirmationToken)) {
      return;
    }
    setStatus('error');
    setErrorMessage('Utility payment could not be confirmed.');
    return;
  }

  try {
    if (!nextReference) {
      throw new Error('Payment reference is missing.');
    }

    if (gateway === JUICYWAY_GATEWAY) {
      if (!isCurrentVtuConfirmation(confirmationToken)) {
        return;
      }
      setStatus('success');
      scheduleDelayedNavigation(() => {
        if (!isCurrentVtuConfirmation(confirmationToken)) {
          return;
        }
        routeToUtilityResult({
          amount,
          customerIdentifier,
          isMountedRef,
          resultAmount: fallbackAmount,
          resultCustomerIdentifier: fallbackCustomerIdentifier,
          resultReference: nextReference,
          resultStatus: 'successful',
          utilityType,
        });
      });
      return;
    }

    const result = await waitForVtuConfirmation({
      gateway,
      reference: nextReference,
    });
    if (!isCurrentVtuConfirmation(confirmationToken)) {
      return;
    }
    setStatus('success');
    scheduleDelayedNavigation(() => {
      if (!isCurrentVtuConfirmation(confirmationToken)) {
        return;
      }
      routeToUtilityResult({
        amount,
        customerIdentifier,
        isMountedRef,
        resultAmount: result.amount,
        resultCashback: result.cashback,
        resultCustomerIdentifier:
          result.customerIdentifier ?? fallbackCustomerIdentifier,
        resultReference: result.reference,
        resultStatus: 'successful',
        resultVoucherPin: result.voucherPin,
        utilityType,
      });
    });
  } catch (error) {
    if (!isCurrentVtuConfirmation(confirmationToken)) {
      return;
    }
    if (error instanceof VtuPaymentStillProcessingError) {
      setStatus('processing');
      routeToUtilityResult({
        amount,
        customerIdentifier,
        isMountedRef,
        resultAmount: error.amount ?? fallbackAmount,
        resultCustomerIdentifier:
          error.customerIdentifier ?? fallbackCustomerIdentifier,
        resultReference: error.reference,
        resultStatus: 'processing',
        utilityType,
      });
      return;
    }

    setStatus('error');
    setErrorMessage(
      error instanceof Error ? error.message : 'Payment confirmation failed.'
    );
  }
}
