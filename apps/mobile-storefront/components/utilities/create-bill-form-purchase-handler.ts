import { router } from 'expo-router';
import { Alert } from 'react-native';
import type { useUtilityPayment } from '@/hooks/use-utility-payment';
import type { Biller } from '@/hooks/use-vtu-billers';
import {
  chargeSavedVtuCard,
  initializeVtuCheckout,
  isSavedVtuCardChargeProcessing,
  requiresSavedVtuCardAuthorization,
  type VTUPaymentGateway,
  VtuPaymentStillProcessingError,
  waitForVtuConfirmation,
} from '@/lib/vtu-checkout';
import { IDENTIFIER_LABELS } from './bill-form.constants';
import type { BillFormProps } from './bill-form.types';

type PaymentState = ReturnType<typeof useUtilityPayment>;
const SAVED_CARD_CONFIRMATION_GATEWAY: VTUPaymentGateway = 'paystack';
const MIN_BILL_PAYMENT_AMOUNT = 50;
const MAX_BILL_PAYMENT_AMOUNT = 500_000;
const GENERIC_PAYMENT_ERROR_MESSAGE = 'Payment failed. Please try again.';
const AMOUNT_DISPLAY_LOCALE = 'en-NG';

interface BillCustomer {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface CreateBillFormPurchaseHandlerInput {
  amount: string;
  billType: 'electricity' | 'cable_tv' | 'betting';
  canShowPayment: boolean;
  customer: BillCustomer | null | undefined;
  customerId: string;
  dismissKeyboard: () => void;
  getIsSubmitting: () => boolean;
  numericAmount: number;
  onSuccess: BillFormProps['onSuccess'];
  payment: PaymentState;
  selectedBiller: Biller | null;
  selectedBillItemIdentifier: string | null;
  selectedBillItemPathLabel: string;
  setIsSubmitting: (isSubmitting: boolean) => void;
  type: BillFormProps['type'];
}

function getSafePaymentErrorMessage(error: unknown): string {
  return error instanceof VtuPaymentStillProcessingError
    ? 'Payment is still processing. Please check your history shortly.'
    : GENERIC_PAYMENT_ERROR_MESSAGE;
}

export function createBillFormPurchaseHandler({
  amount,
  billType,
  canShowPayment,
  customer,
  customerId,
  dismissKeyboard,
  getIsSubmitting,
  numericAmount,
  onSuccess,
  payment,
  selectedBiller,
  selectedBillItemIdentifier,
  selectedBillItemPathLabel,
  setIsSubmitting,
  type,
}: CreateBillFormPurchaseHandlerInput) {
  return async () => {
    dismissKeyboard();
    if (getIsSubmitting()) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (!selectedBiller) {
        Alert.alert('Missing Provider', 'Please select a provider.');
        return;
      }
      if (!canShowPayment) {
        Alert.alert(
          'Verification Required',
          `Please verify your ${IDENTIFIER_LABELS[type].toLowerCase()} before making a purchase.`
        );
        return;
      }
      if (!amount) {
        Alert.alert('Missing Amount', 'Please enter an amount.');
        return;
      }
      if (
        numericAmount < MIN_BILL_PAYMENT_AMOUNT ||
        numericAmount > MAX_BILL_PAYMENT_AMOUNT
      ) {
        Alert.alert(
          'Invalid Amount',
          `Amount must be between ₦${MIN_BILL_PAYMENT_AMOUNT.toLocaleString(AMOUNT_DISPLAY_LOCALE)} and ₦${MAX_BILL_PAYMENT_AMOUNT.toLocaleString(AMOUNT_DISPLAY_LOCALE)}.`
        );
        return;
      }
      if (!payment.selectedSavedCardId && !payment.selectedGateway) {
        Alert.alert(
          'Select Payment Method',
          'Choose a payment method before continuing.'
        );
        return;
      }

      const customerName =
        [customer?.first_name, customer?.last_name].filter(Boolean).join(' ') ||
        customer?.email ||
        undefined;
      const payload = {
        amount: numericAmount,
        billItemIdentifier: selectedBillItemIdentifier ?? undefined,
        billerName: selectedBillItemPathLabel
          ? `${selectedBiller.billerName} - ${selectedBillItemPathLabel}`
          : selectedBiller.billerName,
        customerIdentifier: customerId,
        customerName,
        customerPhone: customer?.phone || undefined,
        type: billType,
      };
      if (payment.selectedSavedCardId) {
        const result = await chargeSavedVtuCard({
          ...payload,
          savedPaymentMethodId: payment.selectedSavedCardId,
        });
        if (requiresSavedVtuCardAuthorization(result)) {
          router.push({
            pathname: '/payment-gateway',
            params: {
              amount: String(numericAmount),
              authorizationUrl: result.authorization_url,
              customerIdentifier: customerId,
              gateway: result.gateway,
              paymentKind: 'vtu',
              reference: result.reference,
              utilityType: type,
            },
          });
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
              customerIdentifier: customerId,
              reference: confirmed.reference,
              status: 'successful',
              voucherPin: confirmed.voucherPin,
            });
          } catch (error) {
            if (error instanceof VtuPaymentStillProcessingError) {
              onSuccess({
                amount: error.amount ?? numericAmount,
                customerIdentifier: error.customerIdentifier ?? customerId,
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
          customerIdentifier: customerId,
          reference: result.reference,
          status: 'successful',
          voucherPin: result.voucherPin,
        });
        return;
      }

      const selectedGateway = payment.selectedGateway;
      // This guard is intentionally retained for runtime safety and
      // TypeScript narrowing before selectedGateway is sent to checkout.
      if (!selectedGateway) {
        Alert.alert(
          'Select Payment Method',
          'Choose a payment method before continuing.'
        );
        return;
      }

      const result = await initializeVtuCheckout({
        ...payload,
        gateway: selectedGateway,
      });
      router.push({
        pathname: '/payment-gateway',
        params: {
          amount: String(numericAmount),
          authorizationUrl: result.authorization_url,
          customerIdentifier: customerId,
          gateway: result.gateway,
          paymentKind: 'vtu',
          reference: result.reference,
          utilityType: type,
        },
      });
    } catch (error) {
      Alert.alert(
        'Payment Failed',
        getSafePaymentErrorMessage(error)
      );
    } finally {
      setIsSubmitting(false);
    }
  };
}
