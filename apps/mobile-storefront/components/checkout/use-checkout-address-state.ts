import type { User } from '@supabase/supabase-js';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { deriveCheckoutIdentity } from '@/lib/checkout-identity';
import type { ShippingAddressInput } from '@/lib/validation';
import { trackCheckoutRouteStarted } from '@/services/tiktok-checkout-route-tracking';
import type { Customer } from '@/stores/auth-store';
import type { CartItem } from '@/stores/cart-store';
import { isCheckoutContactComplete } from './checkout-contact-readiness';
import { isCheckoutAddressComplete } from './checkout-continue-readiness';
import {
  CHECKOUT_API_BASE_URL,
  CHECKOUT_MERCHANT_ID,
  shippingAddressResolver,
} from './checkout-screen.constants';
import { useCheckoutSavedAddresses } from './use-checkout-saved-addresses';
import { useCheckoutShipping } from './use-checkout-shipping';

interface UseCheckoutAddressStateParams {
  customer: Customer | null;
  isAuthenticated: boolean;
  items: CartItem[];
  subtotal: number;
  user: User | null;
}

export function useCheckoutAddressState({
  customer,
  isAuthenticated,
  items,
  subtotal,
  user,
}: UseCheckoutAddressStateParams) {
  const hasTrackedStart = useRef(false);
  const [saveDetails, setSaveDetails] = useState(false);
  const [accountPassword, setAccountPassword] = useState('');
  const checkoutIdentity = deriveCheckoutIdentity({ customer, user });
  const checkoutEmail = checkoutIdentity.email;
  const checkoutFirstName = checkoutIdentity.firstName;
  const checkoutLastName = checkoutIdentity.lastName;
  const checkoutPhone = checkoutIdentity.phone;

  const form = useForm<ShippingAddressInput>({
    resolver: shippingAddressResolver,
    defaultValues: {
      email: checkoutEmail,
      firstName: checkoutFirstName,
      lastName: checkoutLastName,
      phone: checkoutPhone,
      address: '',
      city: '',
      state: '',
      notes: '',
    },
    mode: 'onBlur',
    shouldUnregister: false,
  });
  const { control, getValues, reset, setValue } = form;
  // useWatch instead of watch(): watch() returns interior-mutable values that
  // force React Compiler to skip memoizing this hook (incompatible-library).
  const watchedState = useWatch({ control, name: 'state' });
  const watchedCity = useWatch({ control, name: 'city' });
  const watchedAddress = useWatch({ control, name: 'address' });
  const watchedPhone = useWatch({ control, name: 'phone' });
  const watchedFirstName = useWatch({ control, name: 'firstName' });
  const watchedLastName = useWatch({ control, name: 'lastName' });
  const watchedEmail = useWatch({ control, name: 'email' });
  const isAddressComplete = isCheckoutAddressComplete({
    email: watchedEmail,
    firstName: watchedFirstName,
    lastName: watchedLastName,
    phone: watchedPhone,
    address: watchedAddress,
    city: watchedCity,
    state: watchedState,
  });

  const shipping = useCheckoutShipping({
    apiBaseUrl: CHECKOUT_API_BASE_URL,
    customer,
    items,
    setValue,
    watchedAddress,
    watchedCity,
    watchedEmail,
    watchedFirstName,
    watchedLastName,
    watchedPhone,
    watchedState,
  });
  const hasInitialContactIdentity = Boolean(
    checkoutEmail && checkoutFirstName && checkoutLastName && checkoutPhone
  );
  const isContactComplete = isCheckoutContactComplete({
    email: watchedEmail,
    firstName: watchedFirstName,
    lastName: watchedLastName,
    phone: watchedPhone,
  });
  const savedAddresses = useCheckoutSavedAddresses({
    customerId: customer?.id,
    hasInitialContactIdentity,
    isAuthenticated,
    merchantId: CHECKOUT_MERCHANT_ID,
    setCommittedAddress: shipping.setCommittedAddress,
    setValue,
  });

  useEffect(() => {
    if (!isContactComplete) {
      savedAddresses.setIsContactCollapsed(false);
      return;
    }

    // Once contact details are valid, keep the completed section compact so
    // the newly unlocked delivery form gets the user's attention.
    savedAddresses.setIsContactCollapsed(true);
  }, [isContactComplete, savedAddresses.setIsContactCollapsed]);

  useEffect(() => {
    if (!hasTrackedStart.current && items.length > 0) {
      void trackCheckoutRouteStarted({ items, subtotal }).catch(() => {
        // Checkout analytics must not interrupt checkout entry.
      });
      hasTrackedStart.current = true;
    }
  }, [items, subtotal]);

  useEffect(() => {
    if (!isAuthenticated) return;
    reset(
      {
        email: checkoutEmail,
        firstName: checkoutFirstName,
        lastName: checkoutLastName,
        phone: checkoutPhone,
        address: getValues('address'),
        city: getValues('city'),
        state: getValues('state'),
        notes: getValues('notes'),
      },
      { keepDirtyValues: true }
    );
  }, [
    checkoutEmail,
    checkoutFirstName,
    checkoutLastName,
    checkoutPhone,
    getValues,
    isAuthenticated,
    reset,
  ]);

  const currentContactSummary = `${watchedFirstName} ${watchedLastName}`.trim();
  const currentDeliverySummary = [watchedAddress, watchedCity, watchedState]
    .filter(Boolean)
    .join(', ');
  const openNewAddressEditor = () => {
    if (savedAddresses.selectedSavedAddressId) {
      setValue('address', '', { shouldValidate: false });
      setValue('city', '', { shouldValidate: false });
      setValue('state', '', { shouldValidate: false });
    }
    savedAddresses.openNewAddressEditor();
  };

  return {
    accountPassword,
    currentContactSummary,
    currentDeliverySummary,
    form,
    hasContactIdentity: isContactComplete,
    isAddressComplete,
    openNewAddressEditor,
    saveDetails,
    savedAddresses,
    setAccountPassword,
    setSaveDetails,
    shipping,
    watchedCity,
    watchedEmail,
    watchedPhone,
    watchedState,
  };
}

export type CheckoutAddressState = ReturnType<typeof useCheckoutAddressState>;
