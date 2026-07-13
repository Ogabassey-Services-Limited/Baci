import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import type { useUtilityPayment } from '@/hooks/use-utility-payment';
import {
  chargeSavedVtuCard,
  chargeWalletForVtu,
  computeVtuWalletAmount,
  initializeVtuCheckout,
  isSavedVtuCardChargeProcessing,
  requiresSavedVtuCardAuthorization,
  shouldRotateWalletIdempotencyKeyForError,
  type VtuConfirmationGateway,
  VtuPaymentStillProcessingError,
  waitForVtuConfirmation,
} from '@/lib/vtu-checkout';
import type { Customer } from '@/stores/auth-store.types';
import type { AirtimeFormProps } from './airtime-form.types';
import {
  buildAirtimeGatewayParams,
  getAirtimeCustomerName,
  validateAirtimePurchaseInput,
} from './airtime-form-controller.helpers';

const SAVED_CARD_CONFIRMATION_GATEWAY: VtuConfirmationGateway = 'paystack';

interface UseAirtimePurchaseHandlerProps {
  amount: string;
  numericAmount: number;
  phoneNumber: string;
  selectedProvider: string | null;
  payment: ReturnType<typeof useUtilityPayment>;
  customer: Customer | null;
  onSuccess: AirtimeFormProps['onSuccess'];
  dismissKeyboard: () => void;
}

interface ExecuteAirtimePurchaseInput {
  customer: Customer | null;
  isWalletOnly: boolean;
  numericAmount: number;
  onSettled: () => void;
  onSuccess: AirtimeFormProps['onSuccess'];
  payment: ReturnType<typeof useUtilityPayment>;
  phoneNumber: string;
  selectedProvider: string | null;
  walletAmount: number;
}

async function executeAirtimePurchase({
  customer,
  isWalletOnly,
  numericAmount,
  onSettled,
  onSuccess,
  payment,
  phoneNumber,
  selectedProvider,
  walletAmount,
}: ExecuteAirtimePurchaseInput): Promise<void> {
  let didNavigate = false;
  try {
    const customerName = getAirtimeCustomerName(customer);

    if (isWalletOnly) {
      const idempotencyKey = payment.getWalletIdempotencyKey();
      try {
        const result = await chargeWalletForVtu({
          amount: numericAmount,
          customerName,
          customerPhone: customer?.phone,
          networkProvider: selectedProvider ?? undefined,
          phoneNumber,
          type: 'airtime',
          walletAmount: numericAmount,
          idempotencyKey,
        });
        if (result.status === 'processing') {
          onSuccess({
            amount: result.amount ?? numericAmount,
            customerIdentifier: phoneNumber,
            reference: result.reference,
            status: 'processing',
          });
          return;
        }
        payment.resetWalletIdempotencyKey();
        onSuccess({
          amount: result.amount ?? numericAmount,
          cashback: result.cashback,
          reference: result.reference,
          status: 'successful',
          voucherPin: result.voucherPin,
        });
        return;
      } catch (error) {
        if (shouldRotateWalletIdempotencyKeyForError(error)) {
          payment.resetWalletIdempotencyKey();
        }
        throw error;
      }
    }

    if (payment.selectedSavedCardId) {
      const result = await chargeSavedVtuCard({
        amount: numericAmount,
        customerName,
        customerPhone: customer?.phone,
        networkProvider: selectedProvider ?? undefined,
        phoneNumber,
        savedPaymentMethodId: payment.selectedSavedCardId,
        type: 'airtime',
        ...(walletAmount > 0 ? { walletAmount } : {}),
      });

      if (requiresSavedVtuCardAuthorization(result)) {
        router.push({
          pathname: '/payment-gateway',
          params: buildAirtimeGatewayParams({
            amount: numericAmount,
            authorizationUrl: result.authorization_url,
            customerIdentifier: phoneNumber,
            gateway: result.gateway,
            reference: result.reference,
          }),
        });
        didNavigate = true;
        return;
      }

      if (isSavedVtuCardChargeProcessing(result)) {
        try {
          const confirmationGateway =
            result.gateway ?? SAVED_CARD_CONFIRMATION_GATEWAY;
          const confirmed = await waitForVtuConfirmation({
            gateway: confirmationGateway,
            reference: result.reference,
          });
          onSuccess({
            amount: confirmed.amount ?? numericAmount,
            cashback: confirmed.cashback,
            reference: confirmed.reference,
            status: 'successful',
            voucherPin: confirmed.voucherPin,
          });
        } catch (error) {
          if (error instanceof VtuPaymentStillProcessingError) {
            onSuccess({
              amount: error.amount ?? numericAmount,
              customerIdentifier: error.customerIdentifier ?? phoneNumber,
              reference: error.reference,
              status: 'processing',
            });
            return;
          }
          throw error;
        }
        return;
      }

      onSuccess({
        amount: result.amount,
        cashback: result.cashback,
        reference: result.reference,
        status: 'successful',
        voucherPin: result.voucherPin,
      });
      return;
    }

    const selectedGateway = payment.selectedGateway;
    if (!selectedGateway) {
      throw new Error('A payment gateway must be selected before checkout.');
    }

    const result = await initializeVtuCheckout({
      type: 'airtime',
      amount: numericAmount,
      customerName,
      customerPhone: customer?.phone,
      gateway: selectedGateway,
      networkProvider: selectedProvider ?? undefined,
      phoneNumber,
      ...(walletAmount > 0 ? { walletAmount } : {}),
    });
    router.push({
      pathname: '/payment-gateway',
      params: buildAirtimeGatewayParams({
        amount: numericAmount,
        authorizationUrl: result.authorization_url,
        customerIdentifier: phoneNumber,
        gateway: result.gateway,
        reference: result.reference,
      }),
    });
    didNavigate = true;
  } catch (error) {
    console.error('Airtime purchase failed:', error);
    Alert.alert(
      'Payment Failed',
      error instanceof Error ? error.message : 'Something went wrong.'
    );
  } finally {
    if (!didNavigate) {
      onSettled();
    }
  }
}

export function useAirtimePurchaseHandler({
  amount,
  numericAmount,
  phoneNumber,
  selectedProvider,
  payment,
  customer,
  onSuccess,
  dismissKeyboard,
}: UseAirtimePurchaseHandlerProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  const handlePurchase = async () => {
    dismissKeyboard();
    if (isSubmittingRef.current) {
      return;
    }
    isSubmittingRef.current = true;

    const walletAmount = computeVtuWalletAmount(
      payment.walletSelection?.use === true
        ? payment.walletSelection.amount
        : 0,
      numericAmount
    );
    const isWalletOnly = walletAmount > 0 && walletAmount === numericAmount;

    const validationError = validateAirtimePurchaseInput({
      amount,
      isWalletOnly,
      numericAmount,
      phoneNumber,
      selectedGateway: payment.selectedGateway,
      selectedProvider,
      selectedSavedCardId: payment.selectedSavedCardId,
    });
    if (validationError) {
      Alert.alert(validationError.title, validationError.message);
      isSubmittingRef.current = false;
      return;
    }

    setIsSubmitting(true);
    await executeAirtimePurchase({
      customer,
      isWalletOnly,
      numericAmount,
      onSettled: () => {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      },
      onSuccess,
      payment,
      phoneNumber,
      selectedProvider,
      walletAmount,
    });
  };

  return {
    isSubmitting,
    isSubmittingRef,
    handlePurchase,
  };
}
