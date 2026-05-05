import { router } from 'expo-router';
import { Alert } from 'react-native';
import type { useUtilityPayment } from '@/hooks/use-utility-payment';
import { NetworkError, TimeoutError } from '@/lib/fetch-with-timeout';
import {
  chargeSavedVtuCard,
  chargeWalletForVtu,
  initializeVtuCheckout,
  isSavedVtuCardChargeProcessing,
  requiresSavedVtuCardAuthorization,
  VtuPaymentStillProcessingError,
  waitForVtuConfirmation,
} from '@/lib/vtu-checkout';
import { DATA_SAVED_CARD_CONFIRMATION_GATEWAY } from './data-form.styles';

type PaymentState = ReturnType<typeof useUtilityPayment>;

interface DataCustomer {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface DataFormSuccessResult {
  reference: string;
  amount: number;
  customerIdentifier?: string;
  status?: 'processing' | 'successful';
  voucherPin?: string;
  cashback?: { amount: number; newBalance: number };
}

interface CreateDataFormPurchaseHandlerInput {
  customer: DataCustomer | null | undefined;
  dismissKeyboard: () => void;
  getIsSubmitting: () => boolean;
  payment: PaymentState;
  phoneNumber: string;
  planAmount: number;
  selectedPlan: string | null;
  selectedProvider: string | null;
  setIsSubmitting: (isSubmitting: boolean) => void;
  onSuccess: (data: DataFormSuccessResult) => void;
}

export function createDataFormPurchaseHandler({
  customer,
  dismissKeyboard,
  getIsSubmitting,
  onSuccess,
  payment,
  phoneNumber,
  planAmount,
  selectedPlan,
  selectedProvider,
  setIsSubmitting,
}: CreateDataFormPurchaseHandlerInput) {
  return async () => {
    dismissKeyboard();
    if (getIsSubmitting()) {
      return;
    }

    if (!selectedProvider || !phoneNumber || !selectedPlan) {
      Alert.alert(
        'Missing Information',
        'Please enter a phone number and choose a data bundle.'
      );
      return;
    }
    // Bug #64: Prevent submission when planAmount is 0 or not set
    if (planAmount <= 0) {
      Alert.alert(
        'Invalid Amount',
        'Please enter a valid amount before proceeding.'
      );
      return;
    }
    const walletAmount =
      payment.walletSelection?.use === true ? payment.walletSelection.amount : 0;
    const isWalletOnly = walletAmount > 0 && walletAmount === planAmount;
    if (
      !isWalletOnly &&
      !payment.selectedSavedCardId &&
      !payment.selectedGateway
    ) {
      Alert.alert(
        'Select Payment Method',
        'Choose a payment method before continuing.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const customerName =
        [customer?.first_name, customer?.last_name].filter(Boolean).join(' ') ||
        customer?.email ||
        undefined;

      if (isWalletOnly) {
        const idempotencyKey = payment.getWalletIdempotencyKey();
        try {
          const result = await chargeWalletForVtu({
            amount: planAmount,
            customerName,
            customerPhone: customer?.phone || undefined,
            dataPlanCode: selectedPlan,
            networkProvider: selectedProvider,
            phoneNumber,
            type: 'data',
            walletAmount: planAmount,
            idempotencyKey,
          });
          payment.resetWalletIdempotencyKey();
          onSuccess({
            amount: result.amount ?? planAmount,
            cashback: result.cashback
              ? {
                  amount: result.cashback.amount,
                  newBalance: result.cashback.newBalance,
                }
              : undefined,
            reference: result.reference,
            status: result.status,
            voucherPin: result.voucherPin,
          });
          return;
        } catch (error) {
          if (
            !(error instanceof TimeoutError || error instanceof NetworkError)
          ) {
            payment.resetWalletIdempotencyKey();
          }
          throw error;
        }
      }

      if (payment.selectedSavedCardId) {
        const result = await chargeSavedVtuCard({
          amount: planAmount,
          customerName,
          customerPhone: customer?.phone || undefined,
          dataPlanCode: selectedPlan,
          networkProvider: selectedProvider,
          phoneNumber,
          savedPaymentMethodId: payment.selectedSavedCardId,
          type: 'data',
          ...(walletAmount > 0 ? { walletAmount } : {}),
        });

        if (requiresSavedVtuCardAuthorization(result)) {
          router.push({
            pathname: '/payment-gateway',
            params: {
              amount: String(planAmount),
              authorizationUrl: result.authorization_url,
              customerIdentifier: phoneNumber,
              gateway: result.gateway,
              paymentKind: 'vtu',
              reference: result.reference,
              utilityType: 'data',
            },
          });
          return;
        }

        if (isSavedVtuCardChargeProcessing(result)) {
          try {
            const confirmationGateway =
              result.gateway ?? DATA_SAVED_CARD_CONFIRMATION_GATEWAY;
            const confirmed = await waitForVtuConfirmation({
              gateway: confirmationGateway,
              reference: result.reference,
            });
            onSuccess({
              amount: confirmed.amount ?? planAmount,
              cashback: confirmed.cashback
                ? {
                    amount: confirmed.cashback.amount,
                    newBalance: confirmed.cashback.newBalance,
                  }
                : undefined,
              reference: confirmed.reference,
              voucherPin: confirmed.voucherPin,
            });
          } catch (error) {
            if (error instanceof VtuPaymentStillProcessingError) {
              onSuccess({
                amount: error.amount ?? planAmount,
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
          cashback: result.cashback
            ? {
                amount: result.cashback.amount,
                newBalance: result.cashback.newBalance,
              }
            : undefined,
          reference: result.reference,
          voucherPin: result.voucherPin,
        });
        return;
      }

      const result = await initializeVtuCheckout({
        amount: planAmount,
        customerName,
        customerPhone: customer?.phone || undefined,
        dataPlanCode: selectedPlan,
        gateway: payment.selectedGateway,
        networkProvider: selectedProvider,
        phoneNumber,
        type: 'data',
        ...(walletAmount > 0 ? { walletAmount } : {}),
      });
      router.push({
        pathname: '/payment-gateway',
        params: {
          amount: String(planAmount),
          authorizationUrl: result.authorization_url,
          customerIdentifier: phoneNumber,
          gateway: result.gateway,
          paymentKind: 'vtu',
          reference: result.reference,
          utilityType: 'data',
        },
      });
    } catch (error) {
      Alert.alert(
        'Payment Failed',
        error instanceof Error ? error.message : 'Something went wrong.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };
}
