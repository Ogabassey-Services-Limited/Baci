import { router } from 'expo-router';
import { Alert } from 'react-native';
import type { useUtilityPayment } from '@/hooks/use-utility-payment';
import type { Biller } from '@/hooks/use-vtu-billers';
import {
  chargeSavedVtuCard,
  initializeVtuCheckout,
  isSavedVtuCardChargeProcessing,
  requiresSavedVtuCardAuthorization,
  VtuPaymentStillProcessingError,
  waitForVtuConfirmation,
} from '@/lib/vtu-checkout';
import { IDENTIFIER_LABELS } from './bill-form.constants';
import type { BillFormProps } from './bill-form.types';

type PaymentState = ReturnType<typeof useUtilityPayment>;

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
  isSubmitting: boolean;
  numericAmount: number;
  onSuccess: BillFormProps['onSuccess'];
  payment: PaymentState;
  selectedBiller: Biller | null;
  selectedBillItemIdentifier: string | null;
  selectedBillItemPathLabel: string;
  setIsSubmitting: (isSubmitting: boolean) => void;
  type: BillFormProps['type'];
}

export function createBillFormPurchaseHandler({
  amount,
  billType,
  canShowPayment,
  customer,
  customerId,
  dismissKeyboard,
  isSubmitting,
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
    if (isSubmitting) {
      return;
    }
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
    if (numericAmount < 50 || numericAmount > 500_000) {
      Alert.alert('Invalid Amount', 'Amount must be between ₦50 and ₦500,000.');
      return;
    }
    if (!payment.selectedSavedCardId && !payment.selectedGateway) {
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
            const confirmed = await waitForVtuConfirmation({
              gateway: 'paystack',
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
          voucherPin: result.voucherPin,
        });
        return;
      }

      const result = await initializeVtuCheckout({
        ...payload,
        gateway: payment.selectedGateway,
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
        error instanceof Error ? error.message : 'Something went wrong.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };
}
