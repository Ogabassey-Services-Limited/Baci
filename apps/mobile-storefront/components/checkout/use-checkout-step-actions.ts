import type { Dispatch, SetStateAction } from 'react';
import type {
  FieldErrors,
  UseFormHandleSubmit,
  UseFormSetValue,
} from 'react-hook-form';
import { Alert, Keyboard } from 'react-native';
import type { CheckoutStep } from '@/components/checkout/CheckoutStepper';
import { humanizeCheckoutFieldName } from '@/components/checkout/checkout-form-field.helpers';
import {
  PICKUP_STATION_ADDRESS_LINES,
  PICKUP_STATION_CITY,
  PICKUP_STATION_STATE,
} from '@/components/checkout/pickup-station.constants';
import type { ShippingAddressInput } from '@/lib/validation';
import { trackCheckoutStep } from '@/services/analytics';
import { trackCheckoutRoutePaymentInfo } from '@/services/tiktok-checkout-route-tracking';
import {
  type UseCheckoutSubmitParams,
  useCheckoutSubmit,
} from './use-checkout-submit';

interface UseCheckoutStepActionsParams extends UseCheckoutSubmitParams {
  handleSubmit: UseFormHandleSubmit<ShippingAddressInput>;
  setIsContactCollapsed: Dispatch<SetStateAction<boolean>>;
  setIsDeliveryCollapsed: Dispatch<SetStateAction<boolean>>;
  setValue: UseFormSetValue<ShippingAddressInput>;
  step: CheckoutStep;
}

export function useCheckoutStepActions({
  handleSubmit,
  selectedPayment,
  setIsContactCollapsed,
  setIsDeliveryCollapsed,
  setStep,
  setValue,
  step,
  ...submitParams
}: UseCheckoutStepActionsParams) {
  const onCheckoutSubmit = useCheckoutSubmit({
    ...submitParams,
    selectedPayment,
    setStep,
  });
  const onAddressSubmit = (data: ShippingAddressInput) => {
    trackCheckoutStep('shipping_info', {
      state: data.state,
      city: data.city,
    });
    setStep('payment');
  };
  const handleAddressValidationError = (
    errors: FieldErrors<ShippingAddressInput>
  ) => {
    const hasContactErrors = Boolean(
      errors.firstName || errors.lastName || errors.phone || errors.email
    );
    const hasDeliveryErrors = Boolean(
      errors.address || errors.city || errors.state
    );

    if (hasContactErrors) setIsContactCollapsed(false);
    if (hasDeliveryErrors) setIsDeliveryCollapsed(false);

    const failingFields = (
      Object.keys(errors) as Array<keyof ShippingAddressInput>
    ).filter((field) => Boolean(errors[field]));
    const firstField = failingFields[0];
    const message =
      firstField && errors[firstField]?.message
        ? errors[firstField]?.message
        : firstField
          ? `Please complete your ${humanizeCheckoutFieldName(firstField)} before continuing.`
          : hasDeliveryErrors
            ? 'Please complete your delivery address before continuing.'
            : 'Please complete your contact details before continuing.';

    Alert.alert('Incomplete Details', message, [{ text: 'OK' }]);
  };

  const handleContinue = () => {
    Keyboard.dismiss();

    if (step === 'address') {
      if (submitParams.deliveryMethod === 'pickup_station') {
        setValue('address', PICKUP_STATION_ADDRESS_LINES.join(', '), {
          shouldValidate: true,
        });
        setValue('city', PICKUP_STATION_CITY, { shouldValidate: true });
        setValue('state', PICKUP_STATION_STATE, { shouldValidate: true });
      }
      handleSubmit(onAddressSubmit, handleAddressValidationError)();
      return;
    }

    if (step === 'payment') {
      if (!selectedPayment) {
        Alert.alert(
          'Select Payment Method',
          'Choose how you want to pay before continuing to review.'
        );
        return;
      }
      trackCheckoutStep('payment_method', {
        payment_method: selectedPayment,
      });
      void trackCheckoutRoutePaymentInfo(selectedPayment);
      setStep('review');
    }
  };

  const handlePlaceOrder = handleSubmit(onCheckoutSubmit, () => {
    Alert.alert(
      'Incomplete Details',
      'Please fill in all required fields (Address, City, Phone) to place your order.',
      [{ text: 'OK' }]
    );
  });

  return {
    handleAddressValidationError,
    handleContinue,
    handlePlaceOrder,
    onAddressSubmit,
  };
}
